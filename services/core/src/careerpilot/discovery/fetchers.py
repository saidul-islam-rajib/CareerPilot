from collections.abc import Callable
from pathlib import Path

import httpx

from careerpilot.discovery.ports import Fetcher, FetchError
from careerpilot.discovery.safety import public_https_url
from careerpilot.platform.config import DiscoveryConfig, FetchMode, SourceDefinition, repository_root

USER_AGENT_HEADER = "User-Agent"
UNSAFE_ADDRESS = "unsafe_address"

AddressCheck = Callable[[str], str | None]


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
    def __init__(self, config: DiscoveryConfig, check_address: AddressCheck = public_https_url) -> None:
        self._config = config
        self._check_address = check_address

    def fetch(self, definition: SourceDefinition) -> str:
        try:
            with httpx.Client(
                headers={USER_AGENT_HEADER: self._config.user_agent},
                timeout=self._config.timeout_seconds,
                follow_redirects=True,
                event_hooks={"request": [self._guard]},
            ) as client:
                response = client.get(definition.url)
                response.raise_for_status()
        except UnsafeAddressError as error:
            raise FetchError(UNSAFE_ADDRESS) from error
        except httpx.HTTPError as error:
            raise FetchError(type(error).__name__) from error
        return response.text

    def _guard(self, request: httpx.Request) -> None:
        if self._check_address(str(request.url)) is None:
            raise UnsafeAddressError(UNSAFE_ADDRESS)


def fetcher_for(config: DiscoveryConfig) -> Fetcher:
    if config.fetch_mode is FetchMode.LIVE:
        return HttpFetcher(config)
    return FixtureFetcher(repository_root() / config.fixture_root)
