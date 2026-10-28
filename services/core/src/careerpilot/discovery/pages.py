import json
from dataclasses import dataclass, field
from html.parser import HTMLParser
from typing import Any, cast
from urllib.parse import urljoin, urlsplit

from careerpilot.discovery.text import plain_text

JSON_LD_TYPE = "application/ld+json"
FEED_TYPES = frozenset({"application/rss+xml", "application/atom+xml"})
SITE_NAME_PROPERTY = "og:site_name"
JOB_POSTING = "JobPosting"
GRAPH = "@graph"
TYPE = "@type"
DASHES = (chr(0x2013), chr(0x2014))
TITLE_SEPARATORS = (" | ", " - ", " :: ", *(f" {dash} " for dash in DASHES))
HOST_PREFIXES = ("www.", "careers.", "career.", "jobs.", "job.")


@dataclass
class Anchor:
    url: str
    text: str


@dataclass
class PageScan:
    url: str
    title: str = ""
    site_name: str = ""
    anchors: list[Anchor] = field(default_factory=list[Anchor])
    feeds: list[str] = field(default_factory=list[str])
    structured: list[Any] = field(default_factory=list[Any])

    def job_postings(self) -> list[dict[str, Any]]:
        found: list[dict[str, Any]] = []
        for document in self.structured:
            collect_postings(document, found)
        return found

    def organization(self) -> str:
        if self.site_name:
            return self.site_name
        for separator in TITLE_SEPARATORS:
            if separator in self.title:
                return self.title.rsplit(separator, 1)[-1].strip()
        return host_name(self.url)


def host_name(url: str) -> str:
    host = (urlsplit(url).hostname or "").lower()
    for prefix in HOST_PREFIXES:
        host = host.removeprefix(prefix)
    return host.split(".")[0].replace("-", " ").title()


def collect_postings(value: Any, found: list[dict[str, Any]]) -> None:
    if isinstance(value, list):
        for item in cast("list[Any]", value):
            collect_postings(item, found)
        return
    if not isinstance(value, dict):
        return
    document = cast("dict[str, Any]", value)
    kind = document.get(TYPE)
    kinds = cast("list[Any]", kind) if isinstance(kind, list) else [kind]
    if JOB_POSTING in kinds:
        found.append(document)
    if GRAPH in document:
        collect_postings(document[GRAPH], found)


class _Scanner(HTMLParser):
    def __init__(self, page: PageScan) -> None:
        super().__init__(convert_charrefs=True)
        self._page = page
        self._anchor: str | None = None
        self._anchor_text: list[str] = []
        self._in_title = False
        self._in_json_ld = False
        self._json_text: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        values = {key: value or "" for key, value in attrs}
        if tag == "a" and values.get("href"):
            self._anchor = urljoin(self._page.url, values["href"].strip())
            self._anchor_text = []
        elif tag == "title":
            self._in_title = True
        elif tag == "script" and values.get("type", "").lower() == JSON_LD_TYPE:
            self._in_json_ld = True
            self._json_text = []
        elif tag == "meta" and values.get("property", "").lower() == SITE_NAME_PROPERTY:
            self._page.site_name = values.get("content", "").strip()
        elif tag == "link" and values.get("type", "").lower() in FEED_TYPES and values.get("href"):
            self._page.feeds.append(urljoin(self._page.url, values["href"].strip()))

    def handle_endtag(self, tag: str) -> None:
        if tag == "a" and self._anchor is not None:
            self._page.anchors.append(Anchor(url=self._anchor, text=plain_text(" ".join(self._anchor_text))))
            self._anchor = None
        elif tag == "title":
            self._in_title = False
        elif tag == "script" and self._in_json_ld:
            self._in_json_ld = False
            try:
                self._page.structured.append(json.loads("".join(self._json_text)))
            except json.JSONDecodeError:
                return

    def handle_data(self, data: str) -> None:
        if self._anchor is not None:
            self._anchor_text.append(data)
        if self._in_title:
            self._page.title += data.strip()
        if self._in_json_ld:
            self._json_text.append(data)


def scan_page(url: str, body: str) -> PageScan:
    page = PageScan(url=url)
    _Scanner(page).feed(body)
    return page


def looks_like_feed(body: str) -> bool:
    head = body.lstrip()[:200].lower()
    return head.startswith("<?xml") or head.startswith("<rss") or head.startswith("<feed")
