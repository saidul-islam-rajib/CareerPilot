import re
import time
from collections.abc import Callable
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Protocol

from careerpilot.integrations.models import MailMessage
from careerpilot.integrations.ports import GoogleError
from careerpilot.platform.clock import Clock
from careerpilot.portal.config import AdapterConfig, VerificationConfig, host_matches

LABEL_SEPARATOR = "."
REGISTRABLE_LABELS = 2


class MailReader(Protocol):
    def recent_mail(self, user_id: str, query: str, limit: int) -> list[MailMessage] | None: ...


@dataclass(frozen=True)
class VerificationHit:
    code: str | None = None
    link: str | None = None


def registrable(host: str) -> str:
    labels = host.lower().split(LABEL_SEPARATOR)
    return LABEL_SEPARATOR.join(labels[-REGISTRABLE_LABELS:])


def sender_domains(host: str, adapter: AdapterConfig | None) -> list[str]:
    extra = adapter.mail_sender_domains if adapter else []
    return [registrable(host), *extra]


class VerificationFetcher:
    def __init__(
        self,
        config: VerificationConfig,
        clock: Clock,
        reader: MailReader,
        sleep: Callable[[float], None] = time.sleep,
    ) -> None:
        self._config = config
        self._clock = clock
        self._reader = reader
        self._sleep = sleep

    def wait_for(self, user_id: str, host: str, adapter: AdapterConfig | None) -> VerificationHit | None:
        domains = sender_domains(host, adapter)
        since = self._clock.now() - timedelta(minutes=self._config.recent_minutes)
        for attempt in range(self._config.max_polls):
            if attempt:
                self._sleep(self._config.poll_interval_seconds)
            hit = self._poll(user_id, host, domains, since)
            if hit is not None:
                return hit
        return None

    def _poll(self, user_id: str, host: str, domains: list[str], since: datetime) -> VerificationHit | None:
        cfg = self._config
        senders = cfg.any_separator.join(cfg.sender_template.format(domain=d) for d in domains)
        query = cfg.query_template.format(after=int(self._clock.now().timestamp() - cfg.recent_minutes * 60), senders=senders)
        try:
            messages = self._reader.recent_mail(user_id, query, cfg.max_messages)
        except GoogleError:
            return None
        for message in sorted(messages or [], key=lambda m: m.received_at, reverse=True):
            if message.received_at >= since and self._from_domain(message, domains):
                hit = self._extract(message, host)
                if hit is not None:
                    return hit
        return None

    @staticmethod
    def _from_domain(message: MailMessage, domains: list[str]) -> bool:
        address = message.sender_address.lower().rsplit("@", 1)[-1]
        return any(host_matches(address, domain) for domain in domains)

    def _extract(self, message: MailMessage, host: str) -> VerificationHit | None:
        cfg = self._config
        for url in re.findall(cfg.link_pattern, message.body):
            target = re.sub(r"^https?://", "", url).split("/")[0].split(":")[0].lower()
            same_site = registrable(target) == registrable(host)
            if same_site and any(word in url.lower() for word in cfg.link_words):
                return VerificationHit(link=url.rstrip(".,)"))
        found = re.search(cfg.code_pattern, f"{message.subject} {message.body}")
        return VerificationHit(code=found.group(1)) if found else None
