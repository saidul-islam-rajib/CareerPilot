from collections.abc import Callable
from pathlib import Path

import httpx

from careerpilot.discovery.ports import Fetcher, FetchError
from careerpilot.discovery.safety import UNREACHABLE, address_problem
from careerpilot.platform.config import DiscoveryConfig, FetchMode, SourceDefinition, repository_root

USER_AGENT_HEADER = "User-Agent"
HTTP_STATUS = "http_status"
PAGES_UNAVAILABLE = "pages_unavailable"

AddressProblem = Callable[[str], str | None]
PageFetcher = Callable[[str], tuple[str, str]]


class UnsafeAddressError(Exception):
    pass


class FixtureFetcher:
    def __init__(self, root: Path) -> None:
        self._root = root

    def fetch(self, definition: SourceDefinition) -> str:
        path = self._root / definition.fixture
        if not definition.fixture or not path.is_file():
            raise FetchError("fixture_missing")
        return path.read_text(encoding="utf-8")


class HttpFetcher:
    def __init__(self, config: DiscoveryConfig, problem: AddressProblem = address_problem) -> None:
        self._config = config
        self._problem = problem

    def fetch(self, definition: SourceDefinition) -> str:
        return self.fetch_url(definition.url)[1]

    def fetch_page(self, url: str) -> str:
        return self.fetch_url(url)[1]

    def fetch_url(self, url: str) -> tuple[str, str]:
        for _attempt in range(self._config.fetch_attempts - 1):
            try:
                return self._fetch_once(url)
            except FetchError as error:
                if str(error) != UNREACHABLE:
                    raise
        return self._fetch_once(url)

    def _fetch_once(self, url: str) -> tuple[str, str]:
        try:
            with httpx.Client(
                headers={USER_AGENT_HEADER: self._config.user_agent},
                timeout=self._config.timeout_seconds,
                follow_redirects=True,
                event_hooks={"request": [self._guard]},
            ) as client:
                response = client.get(url)
                response.raise_for_status()
        except UnsafeAddressError as error:
            raise FetchError(str(error)) from error
        except httpx.HTTPStatusError as error:
            raise FetchError(HTTP_STATUS) from error
        except httpx.HTTPError as error:
            raise FetchError(UNREACHABLE) from error
        return str(response.url), response.text

    def _guard(self, request: httpx.Request) -> None:
        problem = self._problem(str(request.url))
        if problem is not None:
            raise UnsafeAddressError(problem)


def fetcher_for(config: DiscoveryConfig) -> Fetcher:
    if config.fetch_mode is FetchMode.LIVE:
        return HttpFetcher(config)
    return FixtureFetcher(repository_root() / config.fixture_root)


def no_pages(_url: str) -> tuple[str, str]:
    raise FetchError(PAGES_UNAVAILABLE)


def page_fetcher_for(config: DiscoveryConfig) -> PageFetcher:
    return HttpFetcher(config).fetch_url if config.fetch_mode is FetchMode.LIVE else no_pages
