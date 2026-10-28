from collections.abc import Callable
from pathlib import Path

import httpx

from careerpilot.discovery.ports import Fetcher, FetchError
from careerpilot.discovery.safety import host_resolves, public_https_url
from careerpilot.platform.config import DiscoveryConfig, FetchMode, SourceDefinition, repository_root

USER_AGENT_HEADER = "User-Agent"
UNSAFE_ADDRESS = "unsafe_address"
HTTP_STATUS = "http_status"
UNREACHABLE = "unreachable"
PAGES_UNAVAILABLE = "pages_unavailable"

AddressCheck = Callable[[str], str | None]
HostCheck = Callable[[str], bool]
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
    def __init__(
        self, config: DiscoveryConfig, check_address: AddressCheck = public_https_url, resolves: HostCheck = host_resolves
    ) -> None:
        self._config = config
        self._check_address = check_address
        self._resolves = resolves

    def fetch(self, definition: SourceDefinition) -> str:
        return self.fetch_url(definition.url)[1]

    def fetch_page(self, url: str) -> str:
        return self.fetch_url(url)[1]

    def fetch_url(self, url: str) -> tuple[str, str]:
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
        url = str(request.url)
        if self._check_address(url) is None:
            raise UnsafeAddressError(UNSAFE_ADDRESS if self._resolves(url) else UNREACHABLE)


def fetcher_for(config: DiscoveryConfig) -> Fetcher:
    if config.fetch_mode is FetchMode.LIVE:
        return HttpFetcher(config)
    return FixtureFetcher(repository_root() / config.fixture_root)


def no_pages(_url: str) -> tuple[str, str]:
    raise FetchError(PAGES_UNAVAILABLE)


def page_fetcher_for(config: DiscoveryConfig) -> PageFetcher:
    return HttpFetcher(config).fetch_url if config.fetch_mode is FetchMode.LIVE else no_pages
