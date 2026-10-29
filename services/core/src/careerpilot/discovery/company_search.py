import re
import time
from collections.abc import Callable, Iterable
from concurrent.futures import Future, ThreadPoolExecutor, wait
from dataclasses import dataclass, replace
from typing import TypeVar

from careerpilot.discovery.pages import TITLE_SEPARATORS, scan_page
from careerpilot.discovery.ports import FetchError
from careerpilot.discovery.resolver import Board, PageFetcher, ResolvedSource, SourceResolver, host_of, normalized_link
from careerpilot.platform.config import CompanySearchConfig, DiscoveryConfig
from careerpilot.platform.enums import SourceQueryKind
from careerpilot.platform.phrases import phrase_tokens
from careerpilot.platform.similarity import TrigramIndex, compact, similarity

T = TypeVar("T")
EMAIL_ADDRESS = re.compile(r"^(?:mailto:)?[^@\s/]+@([A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+)$", re.IGNORECASE)
WEB_ADDRESS = re.compile(r"^(?:[a-z][a-z0-9+.-]*://)?[^\s/@]+\.[a-z]{2,}(?::\d+)?(?:[/?#]\S*)?$", re.IGNORECASE)
LETTER = re.compile(r"[^\W\d_]")
HANDLE_CHARACTERS = re.compile(r"[^a-z0-9]")
TOKEN = "{token}"
MIN_HANDLE = 2
MIN_FIRST_WORD = 3


@dataclass(frozen=True)
class SourceQuery:
    kind: SourceQueryKind
    text: str
    link: str


def source_query(text: str, free_mail_domains: Iterable[str]) -> SourceQuery | None:
    cleaned = text.strip()
    email = EMAIL_ADDRESS.match(cleaned)
    if email:
        domain = email.group(1).lower()
        personal = {d.casefold() for d in free_mail_domains}
        return None if domain in personal else SourceQuery(SourceQueryKind.EMAIL, cleaned, normalized_link(domain))
    if WEB_ADDRESS.match(cleaned):
        return SourceQuery(SourceQueryKind.LINK, cleaned, normalized_link(cleaned))
    if LETTER.search(cleaned):
        return SourceQuery(SourceQueryKind.NAME, " ".join(cleaned.split()), "")
    return None


def is_personal_email(text: str, free_mail_domains: Iterable[str]) -> bool:
    email = EMAIL_ADDRESS.match(text.strip())
    return email is not None and email.group(1).lower() in {d.casefold() for d in free_mail_domains}


@dataclass(frozen=True)
class KnownCompany:
    name: str
    url: str


@dataclass(frozen=True)
class Handle:
    text: str
    exact: bool


@dataclass(frozen=True)
class CompanyMatch:
    site_url: str
    found: ResolvedSource | None
    score: float


@dataclass(frozen=True)
class SearchProbes:
    fetch_page: PageFetcher
    quick: SourceResolver
    resolver: SourceResolver


@dataclass(frozen=True)
class SiteGuess:
    url: str
    score: float


def company_words(name: str, legal_words: frozenset[str]) -> list[str]:
    words = (HANDLE_CHARACTERS.sub("", token) for token in phrase_tokens(name))
    return [word for word in words if word and word not in legal_words]


def company_handles(words: list[str], config: CompanySearchConfig) -> list[Handle]:
    generic = frozenset(config.generic_words)
    focused = [word for word in words if word not in generic] or words
    handles = [Handle("".join(words), exact=True), Handle("-".join(words), exact=True)]
    if focused != words:
        handles += [Handle("".join(focused), exact=False), Handle("-".join(focused), exact=False)]
    if len(words) > 1:
        handles.append(Handle("".join(word[0] for word in words[:-1]) + words[-1], exact=False))
        handles.append(Handle("".join(word[0] for word in words), exact=False))
        if len(words[0]) >= MIN_FIRST_WORD:
            handles.append(Handle(words[0], exact=False))
    handles += [Handle("".join(focused) + suffix, exact=False) for suffix in config.handle_suffixes]
    unique: dict[str, Handle] = {}
    for handle in handles:
        if len(handle.text) >= MIN_HANDLE:
            unique.setdefault(handle.text, handle)
    return list(unique.values())[: config.max_handles]


def site_label(url: str) -> str:
    return host_of(url).split(".")[0]


def acronym(words: list[str]) -> str:
    return "".join(word[0] for word in words)


def page_names(url: str, body: str) -> list[str]:
    page = scan_page(url, body)
    names = [page.site_name, page.title]
    for separator in TITLE_SEPARATORS:
        names += page.title.split(separator)
    return [name.strip() for name in names if name.strip()]


def strongest(matches: list[CompanyMatch]) -> CompanyMatch | None:
    def rank(match: CompanyMatch) -> tuple[int, float]:
        return (match.found.found if match.found is not None else 0), match.score

    return max(matches, key=rank, default=None)


class CompanySearch:
    def __init__(self, probes: "SearchProbes", config: DiscoveryConfig) -> None:
        self._fetch_page = probes.fetch_page
        self._quick = probes.quick
        self._resolver = probes.resolver
        self._boards = [board for board in config.job_boards if TOKEN in board.api]
        self._config = config.company_search
        self._legal = frozenset(config.company_search.legal_words)
        self._loose = self._legal | frozenset(config.company_search.generic_words)

    def known(self, name: str, companies: list[KnownCompany]) -> KnownCompany | None:
        index = TrigramIndex(((company.name, company) for company in companies), self._legal)
        hit = index.best(name, self._config.known_similarity)
        return hit.item if hit is not None else None

    def name_score(self, wanted: str, candidate: str) -> float:
        score = max(similarity(wanted, candidate, self._legal), similarity(wanted, candidate, self._loose))
        words = company_words(wanted, self._legal)
        short = acronym(words) if len(words) > 1 else ""
        if short and compact(candidate, self._legal) == short:
            score = max(score, self._config.name_similarity)
        return score

    def find(self, name: str) -> CompanyMatch | None:
        words = company_words(name, self._legal)
        if not words:
            return None
        handles = company_handles(words, self._config)
        deadline = time.monotonic() + self._config.max_seconds
        pool = ThreadPoolExecutor(max_workers=self._config.parallel_requests)
        try:
            boards = [pool.submit(self._board, name, board, handle) for handle in handles for board in self._board_guesses(handle)]
            homes = [pool.submit(self._home, name, handle, domain) for handle in handles for domain in self._config.domains]
            guesses = sorted(settled(homes, deadline), key=lambda guess: guess.score, reverse=True)[: self._config.max_sites]
            tried = {handle.text for handle in handles}
            for label in dict.fromkeys(site_label(guess.url) for guess in guesses):
                if label and label not in tried:
                    extra = Handle(label, exact=False)
                    boards += [pool.submit(self._board, name, board, extra) for board in self._board_guesses(extra)]
            sites = [pool.submit(self._site, guess) for guess in guesses]
            return strongest([*settled(boards, deadline), *settled(sites, deadline)])
        finally:
            pool.shutdown(wait=False, cancel_futures=True)

    def _board_guesses(self, handle: Handle) -> list[Board]:
        guesses: list[Board] = []
        for pattern in self._boards:
            if handle.text not in {word.lower() for word in pattern.reserved}:
                guesses.append(Board(pattern.connector, pattern.api.replace(TOKEN, handle.text), handle.text))
        return guesses

    def _board(self, name: str, board: Board, handle: Handle) -> CompanyMatch | None:
        found = self._quick.read_board(board.connector, board.url)
        if found is None or found.found == 0:
            return None
        score = self.name_score(name, found.name) if found.name else float(handle.exact)
        if score < self._config.name_similarity:
            return None
        return CompanyMatch(site_url=board.url, found=replace(found, name=found.name or name), score=score)

    def _home(self, name: str, handle: Handle, domain: str) -> SiteGuess | None:
        try:
            final_url, body = self._fetch_page(f"https://{handle.text}.{domain}/")
        except FetchError:
            return None
        score = max((self.name_score(name, candidate) for candidate in page_names(final_url, body)), default=0.0)
        if handle.exact and len(handle.text) >= self._config.min_exact_handle:
            score = max(score, self._config.name_similarity)
        return SiteGuess(final_url, score) if score >= self._config.name_similarity else None

    def _site(self, guess: SiteGuess) -> CompanyMatch | None:
        found = self._resolver.resolve(guess.url)
        return CompanyMatch(site_url=guess.url, found=found, score=guess.score) if found is not None else None


def settled(futures: list[Future[T | None]], deadline: float) -> list[T]:
    done, _pending = wait(futures, timeout=max(0.0, deadline - time.monotonic()))
    results: list[T] = []
    for future in done:
        if future.exception() is None:
            result = future.result()
            if result is not None:
                results.append(result)
    return results


CompanyLookup = Callable[[str], CompanyMatch | None]
