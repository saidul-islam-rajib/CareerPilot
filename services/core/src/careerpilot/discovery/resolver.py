import re
from collections.abc import Callable
from dataclasses import dataclass, field
from itertools import chain
from urllib.parse import urljoin, urlsplit

from careerpilot.discovery.connectors.html import job_links
from careerpilot.discovery.connectors.registry import ConnectorRegistry
from careerpilot.discovery.pages import PageScan, looks_like_feed, scan_page
from careerpilot.discovery.ports import FetchError
from careerpilot.discovery.text import canonical_url
from careerpilot.platform.config import DiscoveryConfig, JobBoardPattern, ListingDefaults, SourceDefinition
from careerpilot.platform.enums import OpportunityType, WorkArrangement

CAREER_WORDS = re.compile(r"career|\bjobs?\b|join[- ]?us|vacanc|opening|work[- ]with[- ]us|hiring|open[- ]positions", re.IGNORECASE)
JOB_FEED_WORDS = re.compile(r"job|career|vacanc|position|opening|recruit", re.IGNORECASE)
QUOTED_PATH = re.compile(r"[\"'`]((?:https://[^\"'`\s/]+)?/[^\"'`\s]{2,})[\"'`]")
API_MARKERS = ("/api/", ".json")
TOKEN_SEPARATORS = re.compile(r"[-_.%]+")
SECURE_SCHEME = "https://"
INSECURE_SCHEME = "http://"
SCHEME_MARK = "://"
RSS = "rss"
HTML = "html"
JSON = "json"
SITE_PREFIX = "www."
DOMAIN_PARTS = 2

PageFetcher = Callable[[str], tuple[str, str]]


@dataclass(frozen=True)
class ResolvedSource:
    connector: str
    url: str
    name: str
    found: int


@dataclass(frozen=True)
class Board:
    connector: str
    url: str
    label: str


@dataclass
class Crawl:
    budget: int
    organization: str = ""
    career: list[str] = field(default_factory=list[str])
    guesses: list[str] = field(default_factory=list[str])
    seen: set[str] = field(default_factory=set[str])
    hosts: set[str] = field(default_factory=set[str])
    best: ResolvedSource | None = None

    def next_url(self) -> str | None:
        while self.budget > 0 and (self.career or self.guesses):
            url = (self.career or self.guesses).pop(0)
            key = canonical_url(url)
            if key not in self.seen:
                self.seen.add(key)
                self.budget -= 1
                return url
        return None

    def offer(self, candidate: ResolvedSource | None) -> None:
        if candidate is not None and (self.best is None or candidate.found > self.best.found):
            self.best = candidate


def normalized_link(link: str) -> str:
    cleaned = link.strip()
    if cleaned.lower().startswith(INSECURE_SCHEME):
        return SECURE_SCHEME + cleaned[len(INSECURE_SCHEME) :]
    return cleaned if SCHEME_MARK in cleaned else SECURE_SCHEME + cleaned


def token_label(token: str) -> str:
    return TOKEN_SEPARATORS.sub(" ", token).strip().title()


def known_boards(patterns: list[JobBoardPattern], text: str) -> list[Board]:
    boards: list[Board] = []
    for pattern in patterns:
        reserved = {word.lower() for word in pattern.reserved}
        for match in re.finditer(pattern.pattern, text, re.IGNORECASE):
            token = match.group(1)
            board = Board(pattern.connector, pattern.api.format(token=token), token_label(token))
            if token.lower() not in reserved and board not in boards:
                boards.append(board)
    return boards


def same_site(origin: str, link: str) -> bool:
    origin_host = (urlsplit(origin).hostname or "").removeprefix(SITE_PREFIX)
    link_host = (urlsplit(link).hostname or "").removeprefix(SITE_PREFIX)
    if not origin_host or not link_host:
        return False
    return link_host.split(".")[-DOMAIN_PARTS:] == origin_host.split(".")[-DOMAIN_PARTS:]


class SourceResolver:
    def __init__(self, fetch_page: PageFetcher, registry: ConnectorRegistry, config: DiscoveryConfig) -> None:
        self._fetch_page = fetch_page
        self._registry = registry
        self._config = config

    def resolve(self, link: str) -> ResolvedSource | None:
        start = normalized_link(link)
        for board in known_boards(self._config.job_boards, start):
            found = self._board(board, "")
            if found:
                return found
        crawl = Crawl(budget=self._config.max_resolve_pages, career=[start])
        while (url := crawl.next_url()) is not None:
            try:
                final_url, body = self._fetch_page(url)
            except FetchError:
                continue
            found = self._visit(crawl, final_url, body)
            if found:
                return found
        return crawl.best

    def _visit(self, crawl: Crawl, url: str, body: str) -> ResolvedSource | None:
        if looks_like_feed(body):
            return self._accept(RSS, url, body, crawl.organization, 1)
        page = scan_page(url, body)
        crawl.organization = crawl.organization or page.organization()
        listed = job_links(page)
        found = self._published(crawl, url, body, page) or self._listed(crawl, url, body, len(listed))
        if found is None and crawl.best is None and CAREER_WORDS.search(f"{page.title} {urlsplit(url).path}"):
            found = self._from_scripts(crawl, url, page)
        if found is None:
            self._queue_next(crawl, url, page, {canonical_url(a.url) for a in listed})
        return found

    def _published(self, crawl: Crawl, url: str, body: str, page: PageScan) -> ResolvedSource | None:
        boards = (self._board(board, crawl.organization) for board in known_boards(self._config.job_boards, body))
        feeds = (self._probe(RSS, feed, crawl.organization) for feed in page.feeds if JOB_FEED_WORDS.search(feed))
        found = next((candidate for candidate in chain(boards, feeds) if candidate is not None), None)
        if found is None and page.job_postings():
            return self._accept(HTML, url, body, crawl.organization, 1)
        return found

    def _listed(self, crawl: Crawl, url: str, body: str, count: int) -> ResolvedSource | None:
        if count >= self._config.min_job_links:
            crawl.offer(self._accept(HTML, url, body, crawl.organization, self._config.min_job_links))
        best = crawl.best
        return best if best is not None and best.found >= self._config.enough_job_links else None

    def _from_scripts(self, crawl: Crawl, url: str, page: PageScan) -> ResolvedSource | None:
        own = [script for script in page.scripts if same_site(url, script)]
        ranked = sorted(own, key=lambda script: CAREER_WORDS.search(script) is None)[: self._config.max_script_scans]
        for script in ranked:
            if crawl.budget <= 0:
                return None
            crawl.budget -= 1
            try:
                _final, code = self._fetch_page(script)
            except FetchError:
                continue
            for api in self._job_apis(crawl, url, code):
                found = self._probe(JSON, api, crawl.organization)
                if found:
                    return found
        return None

    def _job_apis(self, crawl: Crawl, url: str, code: str) -> list[str]:
        apis: list[str] = []
        for path in QUOTED_PATH.findall(code):
            api = urljoin(url, path)
            key = canonical_url(api)
            looks_like_api = any(marker in path for marker in API_MARKERS)
            if looks_like_api and JOB_FEED_WORDS.search(path) and same_site(url, api) and key not in crawl.seen:
                crawl.seen.add(key)
                apis.append(api)
        return apis[: self._config.max_career_links]

    def _queue_next(self, crawl: Crawl, url: str, page: PageScan, jobs: set[str]) -> None:
        links = [
            a.url
            for a in page.anchors
            if CAREER_WORDS.search(f"{a.text} {urlsplit(a.url).path}") and same_site(url, a.url) and canonical_url(a.url) not in jobs
        ]
        crawl.career.extend(links[: self._config.max_career_links])
        host = urlsplit(url).netloc
        if host not in crawl.hosts:
            crawl.hosts.add(host)
            crawl.guesses.extend(urljoin(url, path) for path in self._config.job_page_paths)

    def _board(self, board: Board, organization: str) -> ResolvedSource | None:
        return self._probe(board.connector, board.url, organization or board.label)

    def _probe(self, connector: str, url: str, organization: str) -> ResolvedSource | None:
        try:
            _final, body = self._fetch_page(url)
        except FetchError:
            return None
        return self._accept(connector, url, body, organization, 1)

    def _accept(self, connector: str, url: str, body: str, organization: str, minimum: int) -> ResolvedSource | None:
        reader = self._registry.get(connector)
        if reader is None:
            return None
        definition = SourceDefinition(connector=connector, url=url, defaults=listing_defaults(organization))
        try:
            feed = reader.parse(body, definition)
        except FetchError:
            return None
        if len(feed.listings) < minimum:
            return None
        name = feed.listings[0].organization or organization
        return ResolvedSource(connector=connector, url=url, name=name, found=len(feed.listings))


def listing_defaults(organization: str) -> ListingDefaults:
    return ListingDefaults(
        type=OpportunityType.JOB.value,
        work_arrangement=WorkArrangement.NOT_STATED.value,
        country_code="",
        organization=organization,
    )
