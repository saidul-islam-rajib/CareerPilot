from pathlib import Path

import httpx

from careerpilot.discovery.ports import Fetcher, FetchError
from careerpilot.platform.config import DiscoveryConfig, FetchMode, SourceDefinition, repository_root

USER_AGENT_HEADER = "User-Agent"


class FixtureFetcher:
    def __init__(self, root: Path) -> None:
        self._root = root

    def fetch(self, definition: SourceDefinition) -> str:
        path = self._root / definition.fixture
        if not path.is_file():
            raise FetchError("fixture_missing")
        return path.read_text(encoding="utf-8")


class HttpFetcher:
    def __init__(self, config: DiscoveryConfig) -> None:
        self._config = config

    def fetch(self, definition: SourceDefinition) -> str:
        try:
            response = httpx.get(
                definition.url,
                headers={USER_AGENT_HEADER: self._config.user_agent},
                timeout=self._config.timeout_seconds,
                follow_redirects=True,
            )
            response.raise_for_status()
        except httpx.HTTPError as error:
            raise FetchError(type(error).__name__) from error
        return response.text


def fetcher_for(config: DiscoveryConfig) -> Fetcher:
    if config.fetch_mode is FetchMode.LIVE:
        return HttpFetcher(config)
    return FixtureFetcher(repository_root() / config.fixture_root)
