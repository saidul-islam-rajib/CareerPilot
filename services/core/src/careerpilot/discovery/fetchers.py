from collections.abc import Callable
from pathlib import Path
from urllib.parse import urljoin

import httpx

from careerpilot.discovery.ports import Fetcher, FetchError
from careerpilot.discovery.safety import UNREACHABLE, address_problem
from careerpilot.platform.config import DiscoveryConfig, FetchMode, SourceDefinition, repository_root

USER_AGENT_HEADER = "User-Agent"
LOCATION_HEADER = "location"
INSECURE_SCHEME = "http://"
SECURE_SCHEME = "https://"
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


def secure_link(url: str) -> str:
    return SECURE_SCHEME + url[len(INSECURE_SCHEME) :] if url.lower().startswith(INSECURE_SCHEME) else url


class HttpFetcher:
    def __init__(
        self, config: DiscoveryConfig, problem: AddressProblem = address_problem, transport: httpx.BaseTransport | None = None
    ) -> None:
        self._config = config
        self._problem = problem
        self._transport = transport

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
                follow_redirects=False,
                event_hooks={"request": [self._guard]},
                transport=self._transport,
            ) as client:
                return self._follow(client, url)
        except UnsafeAddressError as error:
            raise FetchError(str(error)) from error
        except httpx.HTTPStatusError as error:
            raise FetchError(HTTP_STATUS) from error
        except httpx.HTTPError as error:
            raise FetchError(UNREACHABLE) from error

    def _follow(self, client: httpx.Client, url: str) -> tuple[str, str]:
        target = url
        for _hop in range(self._config.max_redirects + 1):
            response = client.get(target)
            if not response.is_redirect:
                response.raise_for_status()
                return str(response.url), response.text
            target = secure_link(urljoin(str(response.url), response.headers.get(LOCATION_HEADER, "")))
        raise FetchError(HTTP_STATUS)

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


def quick_page_fetcher_for(config: DiscoveryConfig) -> PageFetcher:
    quick = config.model_copy(update={"timeout_seconds": config.company_search.probe_timeout_seconds, "fetch_attempts": 1})
    return page_fetcher_for(quick)
