from typing import Any

from careerpilot.discovery.connectors.boards import arrangement, country_code, items, joined, json_document, mapping, text
from careerpilot.discovery.models import ParsedFeed, RawListing
from careerpilot.discovery.ports import CONNECTOR_INTERFACE_VERSION
from careerpilot.discovery.text import iso_or_none, plain_text
from careerpilot.platform.config import SourceDefinition
from careerpilot.platform.enums import WorkArrangement


class AshbyConnector:
    key = "ashby"
    version = "1.0.0"
    interface_version = CONNECTOR_INTERFACE_VERSION

    def parse(self, body: str, definition: SourceDefinition) -> ParsedFeed:
        jobs = [job for job in items(mapping(json_document(body)).get("jobs")) if job.get("isListed", True)]
        listings = [listing for listing in (self._listing(job, definition) for job in jobs) if listing is not None]
        return ParsedFeed(listings=listings, skipped=len(jobs) - len(listings))

    @staticmethod
    def _listing(job: dict[str, Any], definition: SourceDefinition) -> RawListing | None:
        title = text(job.get("title"))
        url = text(job.get("jobUrl"))
        defaults = definition.defaults
        if not title or not url or not defaults.organization:
            return None
        postal = mapping(mapping(job.get("address")).get("postalAddress"))
        country = text(postal.get("addressCountry"))
        fallback = WorkArrangement.REMOTE.value if job.get("isRemote") else defaults.work_arrangement
        return RawListing(
            url=url,
            title=title,
            organization=defaults.organization,
            location=text(job.get("location")) or joined(text(postal.get("addressLocality")), country) or defaults.location,
            country_code=country_code(country, defaults.country_code),
            work_arrangement=arrangement(job.get("workplaceType"), fallback),
            type=defaults.type,
            description=text(job.get("descriptionPlain")) or plain_text(text(job.get("descriptionHtml"))),
            published_at=iso_or_none(text(job.get("publishedAt"))),
        )
