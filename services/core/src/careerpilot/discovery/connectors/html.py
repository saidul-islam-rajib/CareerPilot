import re
from collections.abc import Callable
from typing import Any, cast
from urllib.parse import urlsplit

from careerpilot.discovery.models import ParsedFeed, RawListing
from careerpilot.discovery.pages import Anchor, PageScan, scan_page
from careerpilot.discovery.ports import CONNECTOR_INTERFACE_VERSION, FetchError
from careerpilot.discovery.text import canonical_url, iso_or_none, plain_text
from careerpilot.platform.config import SourceDefinition
from careerpilot.platform.enums import WorkArrangement

PageFetcher = Callable[[str], str]

JOB_PATH = re.compile(
    r"/(?:jobs?|careers?|positions?|openings?|vacanc(?:y|ies)|opportunit(?:y|ies)|requisitions?|postings?|roles?)/[^/?#]{2,}",
    re.IGNORECASE,
)
NAVIGATION = frozenset(
    {
        "apply",
        "apply now",
        "career",
        "careers",
        "job",
        "jobs",
        "all jobs",
        "view all",
        "view all jobs",
        "see all jobs",
        "search jobs",
        "open positions",
        "openings",
        "join us",
        "learn more",
        "read more",
        "more",
        "next",
        "previous",
        "back",
        "home",
    }
)
MIN_TITLE = 3
MAX_TITLE = 140
REMOTE_LOCATION_TYPE = "TELECOMMUTE"
COUNTRY_CODE_LENGTH = 2


def job_links(page: PageScan) -> list[Anchor]:
    seen: set[str] = {canonical_url(page.url)}
    links: list[Anchor] = []
    for anchor in page.anchors:
        url = canonical_url(anchor.url)
        text = anchor.text.strip()
        path = urlsplit(anchor.url).path
        if url in seen or not JOB_PATH.search(path) or not MIN_TITLE <= len(text) <= MAX_TITLE or text.casefold() in NAVIGATION:
            continue
        seen.add(url)
        links.append(Anchor(url=anchor.url, text=text))
    return links


def _name(value: Any) -> str:
    if isinstance(value, dict):
        return str(cast("dict[str, Any]", value).get("name") or "").strip()
    return str(value or "").strip()


def _first(value: Any) -> Any:
    if isinstance(value, list):
        values = cast("list[Any]", value)
        return values[0] if values else None
    return value


def _place(posting: dict[str, Any]) -> tuple[str, str]:
    location = _first(posting.get("jobLocation"))
    address = cast("dict[str, Any]", location).get("address") if isinstance(location, dict) else None
    if not isinstance(address, dict):
        return "", ""
    fields = cast("dict[str, Any]", address)
    country = _name(fields.get("addressCountry"))
    parts = [_name(fields.get(key)) for key in ("addressLocality", "addressRegion")] + [country]
    code = country.upper() if len(country) == COUNTRY_CODE_LENGTH else ""
    return ", ".join(part for part in parts if part), code


def _arrangement(posting: dict[str, Any], fallback: str) -> str:
    kinds = posting.get("jobLocationType")
    remote = REMOTE_LOCATION_TYPE in (cast("list[Any]", kinds) if isinstance(kinds, list) else [kinds])
    return WorkArrangement.REMOTE.value if remote else fallback


class HtmlConnector:
    key = "html"
    version = "1.0.0"
    interface_version = CONNECTOR_INTERFACE_VERSION

    def __init__(self, fetch_page: PageFetcher | None = None, max_details: int = 0) -> None:
        self._fetch_page = fetch_page
        self._max_details = max_details

    def parse(self, body: str, definition: SourceDefinition) -> ParsedFeed:
        page = scan_page(definition.url, body)
        postings = page.job_postings()
        if postings:
            listings = [self._from_posting(p, definition, page.url, page) for p in postings]
        else:
            links = job_links(page)
            listings = [self._from_link(anchor, definition, page, index < self._max_details) for index, anchor in enumerate(links)]
        found = [listing for listing in listings if listing is not None]
        return ParsedFeed(listings=found, skipped=len(listings) - len(found))

    def _from_posting(self, posting: dict[str, Any], definition: SourceDefinition, url: str, page: PageScan) -> RawListing | None:
        title = plain_text(str(posting.get("title") or ""))
        if not title:
            return None
        defaults = definition.defaults
        location, country = _place(posting)
        organization = _name(posting.get("hiringOrganization")) or defaults.organization or page.organization()
        return RawListing(
            url=str(posting.get("url") or url),
            title=title,
            organization=organization,
            location=location or defaults.location,
            country_code=country or defaults.country_code,
            work_arrangement=_arrangement(posting, defaults.work_arrangement),
            type=defaults.type,
            description=plain_text(str(posting.get("description") or "")),
            published_at=iso_or_none(str(posting.get("datePosted") or "")),
            deadline=iso_or_none(str(posting.get("validThrough") or "")),
        )

    def _from_link(self, anchor: Anchor, definition: SourceDefinition, page: PageScan, detailed: bool) -> RawListing | None:
        listing = RawListing(
            url=anchor.url,
            title=anchor.text,
            organization=definition.defaults.organization or page.organization(),
            location=definition.defaults.location,
            country_code=definition.defaults.country_code,
            work_arrangement=definition.defaults.work_arrangement,
            type=definition.defaults.type,
            description="",
        )
        return self._detailed(listing, definition) if detailed else listing

    def _detailed(self, listing: RawListing, definition: SourceDefinition) -> RawListing:
        if self._fetch_page is None:
            return listing
        try:
            detail = scan_page(listing.url, self._fetch_page(listing.url))
        except FetchError:
            return listing
        postings = detail.job_postings()
        if not postings:
            return listing
        richer = self._from_posting(postings[0], definition, listing.url, detail)
        if richer is None:
            return listing
        return RawListing(
            url=listing.url,
            title=listing.title,
            organization=richer.organization,
            location=richer.location,
            country_code=richer.country_code,
            work_arrangement=richer.work_arrangement,
            type=richer.type,
            description=richer.description,
            published_at=richer.published_at,
            deadline=richer.deadline,
        )
