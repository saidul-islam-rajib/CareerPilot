from typing import Any

from careerpilot.discovery.connectors.boards import country_code, items, joined, json_document, mapping, text
from careerpilot.discovery.models import ParsedFeed, RawListing
from careerpilot.discovery.ports import CONNECTOR_INTERFACE_VERSION
from careerpilot.discovery.text import iso_or_none
from careerpilot.platform.config import SourceDefinition
from careerpilot.platform.enums import WorkArrangement

POSTING_URL = "https://jobs.smartrecruiters.com/{company}/{posting}"


class SmartRecruitersConnector:
    key = "smartrecruiters"
    version = "1.0.0"
    interface_version = CONNECTOR_INTERFACE_VERSION

    def parse(self, body: str, definition: SourceDefinition) -> ParsedFeed:
        postings = items(mapping(json_document(body)).get("content"))
        listings = [listing for listing in (self._listing(p, definition) for p in postings) if listing is not None]
        return ParsedFeed(listings=listings, skipped=len(postings) - len(listings))

    @staticmethod
    def _listing(posting: dict[str, Any], definition: SourceDefinition) -> RawListing | None:
        title = text(posting.get("name"))
        company = mapping(posting.get("company"))
        organization = text(company.get("name")) or definition.defaults.organization
        identifier = text(company.get("identifier"))
        posting_id = text(posting.get("id"))
        defaults = definition.defaults
        if not title or not organization or not identifier or not posting_id:
            return None
        place = mapping(posting.get("location"))
        country = text(place.get("country"))
        labels = (text(mapping(posting.get(key)).get("label")) for key in ("function", "experienceLevel", "typeOfEmployment"))
        return RawListing(
            url=POSTING_URL.format(company=identifier, posting=posting_id),
            title=title,
            organization=organization,
            location=joined(text(place.get("city")), text(place.get("region")), country.upper()) or defaults.location,
            country_code=country_code(country, defaults.country_code),
            work_arrangement=WorkArrangement.REMOTE.value if place.get("remote") else defaults.work_arrangement,
            type=defaults.type,
            description=" ".join(label for label in labels if label),
            published_at=iso_or_none(text(posting.get("releasedDate"))),
        )
