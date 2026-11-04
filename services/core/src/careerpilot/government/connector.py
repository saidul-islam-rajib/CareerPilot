import re
from collections.abc import Callable
from datetime import date, datetime
from urllib.parse import urlsplit

from careerpilot.discovery.job_links import page_heading
from careerpilot.discovery.pages import scan_page
from careerpilot.discovery.ports import FetchError
from careerpilot.discovery.safety import SAFE_SCHEME
from careerpilot.discovery.text import plain_text
from careerpilot.government.models import CircularContent, ConnectorDraft, FeeRule
from careerpilot.platform.config import GovernmentConfig
from careerpilot.platform.enums import ConnectorFailure
from careerpilot.platform.errors import DomainError, ErrorCode, validation_error

PageFetcher = Callable[[str], tuple[str, str]]
DATE_CANDIDATE = re.compile(r"\d{1,4}[-/]\d{1,2}[-/]\d{1,4}|\d{1,2}\s+[A-Za-z]{3,9},?\s+\d{4}|[A-Za-z]{3,9}\s+\d{1,2},?\s+\d{4}")
AMOUNT = re.compile(r"\d[\d,]*")
KEYWORD_WINDOW = 120
THOUSANDS = ","
COMMA_AFTER_DAY = re.compile(r"(?<=\d),")


class TeletalkReader:
    def __init__(self, config: GovernmentConfig, fetch_page: PageFetcher) -> None:
        self._cfg = config.connector
        self._limits = config.limits
        self._fetch_page = fetch_page

    def read(self, url: str) -> ConnectorDraft:
        self._require_allowed(url)
        try:
            final_url, body = self._fetch_page(url)
        except FetchError as error:
            raise DomainError(ErrorCode.SERVICE_UNAVAILABLE, ConnectorFailure.UNREACHABLE.value) from error
        self._require_allowed(final_url)
        page = scan_page(final_url, body)
        title = page_heading(page)[: self._cfg.max_title_chars]
        text = (page.body_text() or plain_text(body))[: self._limits.max_text_chars]
        if not title or not text:
            raise validation_error(ConnectorFailure.NO_CONTENT.value)
        host = urlsplit(final_url).hostname or ""
        amount = self._fee_amount(text)
        content = CircularContent(
            authority=page.organization() or host,
            title=title,
            source_name=host,
            source_url=final_url,
            notice_url=final_url,
            apply_url=final_url,
            closes_on=self._deadline(text),
            fee=FeeRule(amount=amount) if amount is not None else None,
            source_text=text,
        )
        return ConnectorDraft(content=content)

    def _require_allowed(self, url: str) -> None:
        parts = urlsplit(url.strip())
        host = (parts.hostname or "").lower()
        allowed = any(host == name or host.endswith(f".{name}") for name in self._cfg.allowed_hosts)
        if parts.scheme != SAFE_SCHEME or not allowed:
            raise validation_error(ConnectorFailure.HOST_NOT_ALLOWED.value)

    def _windows(self, text: str, keywords: list[str]) -> list[str]:
        folded = text.casefold()
        found: list[str] = []
        for keyword in keywords:
            start = 0
            while (index := folded.find(keyword.casefold(), start)) != -1:
                found.append(text[index : index + KEYWORD_WINDOW])
                start = index + len(keyword)
        return found

    def _deadline(self, text: str) -> date | None:
        for window in self._windows(text, self._cfg.deadline_keywords):
            for candidate in DATE_CANDIDATE.findall(window):
                parsed = self._parse_date(candidate)
                if parsed is not None:
                    return parsed
        return None

    def _parse_date(self, candidate: str) -> date | None:
        cleaned = COMMA_AFTER_DAY.sub("", candidate) if candidate[:1].isalpha() else candidate
        for pattern in self._cfg.date_formats:
            for value in (candidate, cleaned):
                try:
                    return datetime.strptime(value.strip(), pattern).date()
                except ValueError:
                    continue
        return None

    def _fee_amount(self, text: str) -> int | None:
        for window in self._windows(text, self._cfg.fee_keywords):
            for number in AMOUNT.findall(window):
                digits = number.replace(THOUSANDS, "")
                if digits.isdigit() and int(digits) > 0:
                    return int(digits)
        return None
