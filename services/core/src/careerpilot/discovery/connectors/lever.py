from typing import Any

from careerpilot.discovery.connectors.boards import arrangement, country_code, epoch_ms_iso, items, json_document, mapping, text
from careerpilot.discovery.models import ParsedFeed, RawListing
from careerpilot.discovery.ports import CONNECTOR_INTERFACE_VERSION
from careerpilot.discovery.text import plain_text
from careerpilot.platform.config import SourceDefinition


def _sections(posting: dict[str, Any]) -> list[str]:
    return [f"{text(section.get('text'))} {plain_text(text(section.get('content')))}" for section in items(posting.get("lists"))]


class LeverConnector:
    key = "lever"
    version = "1.0.0"
    interface_version = CONNECTOR_INTERFACE_VERSION

    def parse(self, body: str, definition: SourceDefinition) -> ParsedFeed:
        postings = items(json_document(body))
        listings = [listing for listing in (self._listing(p, definition) for p in postings) if listing is not None]
        return ParsedFeed(listings=listings, skipped=len(postings) - len(listings))

    @staticmethod
    def _listing(posting: dict[str, Any], definition: SourceDefinition) -> RawListing | None:
        title = text(posting.get("text"))
        url = text(posting.get("hostedUrl"))
        defaults = definition.defaults
        if not title or not url or not defaults.organization:
            return None
        categories = mapping(posting.get("categories"))
        description = " ".join([text(posting.get("descriptionPlain")), *_sections(posting), text(posting.get("additionalPlain"))])
        return RawListing(
            url=url,
            title=title,
            organization=defaults.organization,
            location=text(categories.get("location")) or defaults.location,
            country_code=country_code(text(posting.get("country")), defaults.country_code),
            work_arrangement=arrangement(posting.get("workplaceType"), defaults.work_arrangement),
            type=defaults.type,
            description=plain_text(description),
            published_at=epoch_ms_iso(posting.get("createdAt")),
        )
