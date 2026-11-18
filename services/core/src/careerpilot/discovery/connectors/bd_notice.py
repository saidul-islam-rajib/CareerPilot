from urllib.parse import urlsplit

from careerpilot.discovery.models import ParsedFeed, RawListing
from careerpilot.discovery.pages import scan_page
from careerpilot.discovery.ports import CONNECTOR_INTERFACE_VERSION
from careerpilot.discovery.requirements import RequirementExtractor
from careerpilot.discovery.text import canonical_url
from careerpilot.platform.config import BangladeshConfig, SourceDefinition

MIN_TITLE = 8
MAX_TITLE = 240


class BdNoticeConnector:
    key = "bd_notice"
    version = "1.0.0"
    interface_version = CONNECTOR_INTERFACE_VERSION

    def __init__(self, config: BangladeshConfig, extractor: RequirementExtractor) -> None:
        self._config = config
        self._extractor = extractor

    def parse(self, body: str, definition: SourceDefinition) -> ParsedFeed:
        page = scan_page(definition.url, body)
        seen: set[str] = {canonical_url(page.url)}
        listings: list[RawListing] = []
        for anchor in page.anchors:
            url = canonical_url(anchor.url)
            title = anchor.text.strip()
            if url in seen or not self._is_notice(anchor.url, title):
                continue
            seen.add(url)
            listings.append(self._listing(anchor.url, title, definition, page.organization()))
        return ParsedFeed(listings=listings)

    def _is_notice(self, url: str, title: str) -> bool:
        if not MIN_TITLE <= len(title) <= MAX_TITLE:
            return False
        folded = title.casefold()
        is_document = urlsplit(url).path.lower().endswith(tuple(self._config.document_suffixes))
        return is_document or any(word.casefold() in folded for word in self._config.notice_keywords)

    def _listing(self, url: str, title: str, definition: SourceDefinition, site_name: str) -> RawListing:
        defaults = definition.defaults
        found = self._extractor.extract(title)
        return RawListing(
            url=url,
            title=title,
            organization=defaults.organization or site_name,
            location=defaults.location,
            country_code=defaults.country_code or self._config.default_country_code,
            work_arrangement=defaults.work_arrangement,
            type=defaults.type,
            description=title,
            deadline=found.deadline,
        )
