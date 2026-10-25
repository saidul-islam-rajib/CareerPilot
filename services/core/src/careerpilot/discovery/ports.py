from typing import Protocol

from careerpilot.discovery.models import Listing, ParsedFeed
from careerpilot.platform.config import SourceDefinition

CONNECTOR_INTERFACE_VERSION = 1


class FetchError(Exception):
    pass


class SourceConnector(Protocol):
    @property
    def key(self) -> str: ...

    @property
    def version(self) -> str: ...

    @property
    def interface_version(self) -> int: ...

    def parse(self, body: str, definition: SourceDefinition) -> ParsedFeed: ...


class Fetcher(Protocol):
    def fetch(self, definition: SourceDefinition) -> str: ...


class ListingCatalog(Protocol):
    def find_by_url(self, url: str) -> Listing | None: ...

    def find_by_fingerprint(self, fingerprint: str) -> Listing | None: ...

    def save(self, listing: Listing) -> None: ...

    def list_all(self) -> list[Listing]: ...
