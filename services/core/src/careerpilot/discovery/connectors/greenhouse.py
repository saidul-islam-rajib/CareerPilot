import json
from typing import Any, cast

from careerpilot.discovery.models import ParsedFeed, RawListing
from careerpilot.discovery.ports import CONNECTOR_INTERFACE_VERSION, FetchError
from careerpilot.discovery.text import iso_or_none, plain_text
from careerpilot.platform.config import SourceDefinition


class GreenhouseConnector:
    key = "greenhouse"
    version = "1.0.0"
    interface_version = CONNECTOR_INTERFACE_VERSION

    def parse(self, body: str, definition: SourceDefinition) -> ParsedFeed:
        try:
            document = json.loads(body)
        except json.JSONDecodeError as error:
            raise FetchError("invalid_board") from error
        jobs = cast("list[dict[str, Any]]", cast("dict[str, Any]", document).get("jobs", [])) if isinstance(document, dict) else []
        listings = [listing for listing in (self._listing(job, definition) for job in jobs) if listing is not None]
        return ParsedFeed(listings=listings, skipped=len(jobs) - len(listings))

    @staticmethod
    def _listing(job: dict[str, Any], definition: SourceDefinition) -> RawListing | None:
        title = str(job.get("title") or "").strip()
        url = str(job.get("absolute_url") or "").strip()
        if not title or not url:
            return None
        defaults = definition.defaults
        location = cast("dict[str, Any]", job.get("location") or {})
        return RawListing(
            url=url,
            title=title,
            organization=defaults.organization,
            location=str(location.get("name") or defaults.location),
            country_code=defaults.country_code,
            work_arrangement=defaults.work_arrangement,
            type=defaults.type,
            description=plain_text(str(job.get("content") or "")),
            published_at=iso_or_none(job.get("updated_at")),
        )
