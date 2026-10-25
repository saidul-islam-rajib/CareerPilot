from careerpilot.discovery.models import Listing


class InMemoryListingCatalog:
    def __init__(self) -> None:
        self._listings: dict[str, Listing] = {}

    def find_by_url(self, url: str) -> Listing | None:
        return next((item for item in self._listings.values() if any(s.url == url for s in item.sources)), None)

    def find_by_fingerprint(self, fingerprint: str) -> Listing | None:
        return next((item for item in self._listings.values() if item.fingerprint == fingerprint), None)

    def save(self, listing: Listing) -> None:
        self._listings[listing.id] = listing

    def list_all(self) -> list[Listing]:
        return list(self._listings.values())
