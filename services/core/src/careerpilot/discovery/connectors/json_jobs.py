from collections.abc import Iterator
from datetime import UTC, datetime
from typing import Any, cast
from urllib.parse import urljoin

from careerpilot.discovery.connectors.boards import items, joined, json_document, mapping, text
from careerpilot.discovery.models import ParsedFeed, RawListing
from careerpilot.discovery.ports import CONNECTOR_INTERFACE_VERSION
from careerpilot.discovery.text import iso_or_none, plain_text
from careerpilot.platform.clock import iso
from careerpilot.platform.config import JsonJobFields, SourceDefinition

MAX_DEPTH = 4
PLACE_KEYS = ("city", "state", "region", "province", "country")
LINK_PREFIXES = ("https://", "http://", "/")
END_OF_DAY = {"hour": 23, "minute": 59, "second": 59}


def loose_date(value: str, formats: list[str]) -> str | None:
    if not value:
        return None
    exact = iso_or_none(value)
    if exact is not None:
        return exact
    for pattern in formats:
        try:
            return iso(datetime.strptime(value, pattern).replace(tzinfo=UTC, **END_OF_DAY))
        except ValueError:
            continue
    return None


def _scalar(value: Any) -> str:
    if isinstance(value, bool):
        return ""
    if isinstance(value, str | int | float):
        return text(value)
    if isinstance(value, dict):
        fields = cast("dict[str, Any]", value)
        return text(fields.get("name")) or joined(*(text(part) for key, part in fields.items() if key in PLACE_KEYS))
    if isinstance(value, list):
        return " ".join(part for part in (_scalar(entry) for entry in cast("list[Any]", value)) if part)
    return ""


def field_value(item: dict[str, Any], keys: list[str], depth: int = 0) -> str:
    for key in keys:
        found = _scalar(item.get(key))
        if found:
            return found
    if depth >= MAX_DEPTH:
        return ""
    for child in item.values():
        found = field_value(mapping(child), keys, depth + 1) if isinstance(child, dict) else ""
        if found:
            return found
    return ""


def job_lists(value: Any, depth: int = 0) -> Iterator[list[dict[str, Any]]]:
    if depth > MAX_DEPTH:
        return
    if isinstance(value, list):
        rows = items(value)
        if rows:
            yield rows
        for row in rows:
            yield from job_lists(row, depth + 1)
    elif isinstance(value, dict):
        for child in cast("dict[str, Any]", value).values():
            yield from job_lists(child, depth + 1)


class JsonJobsConnector:
    key = "json"
    version = "1.0.0"
    interface_version = CONNECTOR_INTERFACE_VERSION

    def __init__(self, fields: JsonJobFields, date_formats: list[str]) -> None:
        self._fields = fields
        self._date_formats = date_formats

    def parse(self, body: str, definition: SourceDefinition) -> ParsedFeed:
        jobs = self._jobs(json_document(body))
        listings = [listing for listing in (self._listing(job, definition) for job in jobs) if listing is not None]
        return ParsedFeed(listings=listings, skipped=len(jobs) - len(listings))

    def _jobs(self, document: Any) -> list[dict[str, Any]]:
        best: list[dict[str, Any]] = []
        best_count = 0
        for rows in job_lists(document):
            count = sum(1 for row in rows if self._link(row, "") and field_value(row, self._fields.title))
            if count > best_count:
                best, best_count = rows, count
        return best

    def _link(self, job: dict[str, Any], base: str) -> str:
        link = field_value(job, self._fields.link)
        return urljoin(base, link) if link.startswith(LINK_PREFIXES) else ""

    def _listing(self, job: dict[str, Any], definition: SourceDefinition) -> RawListing | None:
        fields = self._fields
        title = plain_text(field_value(job, fields.title))
        url = self._link(job, definition.url)
        defaults = definition.defaults
        if not title or not url or not defaults.organization:
            return None
        return RawListing(
            url=url,
            title=title,
            organization=defaults.organization,
            location=plain_text(field_value(job, fields.location)) or defaults.location,
            country_code=defaults.country_code,
            work_arrangement=defaults.work_arrangement,
            type=defaults.type,
            description=plain_text(field_value(job, fields.description)),
            deadline=loose_date(field_value(job, fields.deadline), self._date_formats),
        )
