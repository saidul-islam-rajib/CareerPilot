import json
from collections.abc import Callable
from typing import Any, cast
from urllib.parse import urlsplit

from careerpilot.discovery.connectors.boards import items, mapping
from careerpilot.discovery.models import ParsedFeed, RawListing
from careerpilot.discovery.ports import CONNECTOR_INTERFACE_VERSION, FetchError
from careerpilot.discovery.text import iso_or_none, plain_text
from careerpilot.platform.config import SourceDefinition
from careerpilot.platform.enums import WorkArrangement

PageFetcher = Callable[[str], str]

JOB_PATH = "/api/career/job/"
END_OF_DAY = "T23:59:59Z"
DETAIL_FIELDS = ("requirements", "responsibilies", "responsibilities")
ARRANGEMENTS = {
    "remote": WorkArrangement.REMOTE,
    "on-site": WorkArrangement.ONSITE,
    "onsite": WorkArrangement.ONSITE,
    "hybrid": WorkArrangement.HYBRID,
}


def _data(document: Any) -> dict[str, Any]:
    if isinstance(document, dict) and "data" in document:
        return cast("dict[str, Any]", cast("dict[str, Any]", document)["data"] or {})
    return cast("dict[str, Any]", document) if isinstance(document, dict) else {}


def _place(address: dict[str, Any]) -> tuple[str, str]:
    def name(key: str) -> str:
        part = address.get(key)
        return str(cast("dict[str, Any]", part).get("name") or "") if isinstance(part, dict) else str(part or "")

    country = address.get("country")
    code = str(cast("dict[str, Any]", country).get("sort_name") or "") if isinstance(country, dict) else ""
    location = ", ".join(part for part in (name("city"), name("state"), name("country")) if part)
    return location, code.upper()


class EasyJobsConnector:
    key = "easyjobs"
    version = "1.0.0"
    interface_version = CONNECTOR_INTERFACE_VERSION

    def __init__(self, fetch_page: PageFetcher | None = None, max_details: int = 0) -> None:
        self._fetch_page = fetch_page
        self._max_details = max_details

    def parse(self, body: str, definition: SourceDefinition) -> ParsedFeed:
        try:
            data = _data(json.loads(body))
        except json.JSONDecodeError as error:
            raise FetchError("invalid_board") from error
        jobs = items(data.get("jobs")) or items(mapping(data.get("jobs")).get("data"))
        company = cast("dict[str, Any]", data.get("company") or {})
        organization = str(company.get("name") or definition.defaults.organization)
        parts = urlsplit(definition.url)
        origin = f"{parts.scheme}://{parts.netloc}"
        listings = [
            listing
            for index, job in enumerate(jobs)
            if (listing := self._listing(job, definition, organization, origin, index < self._max_details)) is not None
        ]
        return ParsedFeed(listings=listings, skipped=len(jobs) - len(listings))

    def _listing(
        self, job: dict[str, Any], definition: SourceDefinition, organization: str, origin: str, detailed: bool
    ) -> RawListing | None:
        title = str(job.get("title") or "").strip()
        slug = str(job.get("slug") or "").strip()
        if not title or not slug or not organization:
            return None
        defaults = definition.defaults
        location, country = _place(cast("dict[str, Any]", job.get("address") or {}))
        arrangement = ARRANGEMENTS.get(str(job.get("job_type") or "").lower())
        expire = str(job.get("expire_at") or "")
        return RawListing(
            url=f"{origin}/{slug}",
            title=title,
            organization=organization,
            location=location or defaults.location,
            country_code=country or defaults.country_code,
            work_arrangement=arrangement.value if arrangement else defaults.work_arrangement,
            type=defaults.type,
            description=self._description(origin, slug) if detailed else "",
            deadline=iso_or_none(f"{expire}{END_OF_DAY}") if expire else None,
        )

    def _description(self, origin: str, slug: str) -> str:
        if self._fetch_page is None:
            return ""
        try:
            post = cast("dict[str, Any]", _data(json.loads(self._fetch_page(f"{origin}{JOB_PATH}{slug}"))).get("post") or {})
        except (FetchError, json.JSONDecodeError):
            return ""
        skills = [str(cast("dict[str, Any]", s).get("name") or s) for s in cast("list[Any]", post.get("skills") or [])]
        sections = [str(post.get(field) or "") for field in DETAIL_FIELDS]
        return plain_text(" ".join([*sections, *skills]))
