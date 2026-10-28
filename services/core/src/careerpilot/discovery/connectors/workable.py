from typing import Any

from careerpilot.discovery.connectors.boards import country_code, items, joined, json_document, mapping, text
from careerpilot.discovery.models import ParsedFeed, RawListing
from careerpilot.discovery.ports import CONNECTOR_INTERFACE_VERSION
from careerpilot.discovery.text import iso_or_none, plain_text
from careerpilot.platform.config import SourceDefinition
from careerpilot.platform.enums import WorkArrangement

DESCRIPTION_FIELDS = ("description", "requirements", "benefits")


class WorkableConnector:
    key = "workable"
    version = "1.0.0"
    interface_version = CONNECTOR_INTERFACE_VERSION

    def parse(self, body: str, definition: SourceDefinition) -> ParsedFeed:
        account = mapping(json_document(body))
        organization = text(account.get("name")) or definition.defaults.organization
        jobs = items(account.get("jobs"))
        listings = [listing for listing in (self._listing(job, definition, organization) for job in jobs) if listing is not None]
        return ParsedFeed(listings=listings, skipped=len(jobs) - len(listings))

    @staticmethod
    def _listing(job: dict[str, Any], definition: SourceDefinition, organization: str) -> RawListing | None:
        title = text(job.get("title"))
        url = text(job.get("url")) or text(job.get("shortlink"))
        defaults = definition.defaults
        if not title or not url or not organization:
            return None
        places = items(job.get("locations"))
        place = places[0] if places else mapping(None)
        city = text(place.get("city")) or text(job.get("city"))
        country = text(place.get("country")) or text(job.get("country"))
        return RawListing(
            url=url,
            title=title,
            organization=organization,
            location=joined(city, country) or defaults.location,
            country_code=country_code(text(place.get("countryCode")), defaults.country_code),
            work_arrangement=WorkArrangement.REMOTE.value if job.get("telecommuting") else defaults.work_arrangement,
            type=defaults.type,
            description=plain_text(" ".join(text(job.get(field)) for field in DESCRIPTION_FIELDS)),
            published_at=iso_or_none(text(job.get("published_on")) or text(job.get("created_at"))),
        )
