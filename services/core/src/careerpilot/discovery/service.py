from collections import defaultdict
from collections.abc import Callable
from dataclasses import dataclass

from careerpilot.discovery.connectors.registry import ConnectorRegistry
from careerpilot.discovery.models import (
    CheckOutcome,
    CircularVersion,
    Listing,
    ListingChange,
    ListingSource,
    RawListing,
    SourceCheck,
)
from careerpilot.discovery.ports import Fetcher, FetchError, ListingCatalog
from careerpilot.discovery.screening import WarningSignScreen
from careerpilot.discovery.text import canonical_url, digest, listing_fingerprint
from careerpilot.platform.clock import Clock, IdGenerator, iso
from careerpilot.platform.config import DiscoveryConfig, SourceDefinition
from careerpilot.platform.enums import OpportunityStatus
from careerpilot.platform.errors import conflict

LISTING_ID_PREFIX = "opp"

SourceDefinitions = Callable[[], dict[str, SourceDefinition]]


def no_extra_sources() -> dict[str, SourceDefinition]:
    return {}


@dataclass(frozen=True)
class DiscoveryContext:
    config: DiscoveryConfig
    clock: Clock
    ids: IdGenerator
    registry: ConnectorRegistry
    fetcher: Fetcher
    catalog: ListingCatalog
    extra_sources: SourceDefinitions = no_extra_sources


class DiscoveryService:
    def __init__(self, context: DiscoveryContext) -> None:
        self._config = context.config
        self._clock = context.clock
        self._ids = context.ids
        self._registry = context.registry
        self._fetcher = context.fetcher
        self._catalog = context.catalog
        self._extra_sources = context.extra_sources
        self._screen = WarningSignScreen(context.config.warning_signs)

    def definitions(self) -> dict[str, SourceDefinition]:
        return {**self._config.sources, **self._extra_sources()}

    def is_configured(self, source_id: str) -> bool:
        return source_id in self.definitions()

    def run(self, source_id: str) -> SourceCheck:
        definition = self.definitions().get(source_id)
        connector = self._registry.get(definition.connector) if definition else None
        if definition is None or connector is None:
            raise conflict("source_not_configured")
        checked_at = iso(self._clock.now())
        try:
            feed = connector.parse(self._fetcher.fetch(definition), definition)
        except FetchError as error:
            return SourceCheck(source_id, CheckOutcome.FAILED, checked_at, found=0, error=str(error))
        raws = feed.listings[: self._config.max_listings_per_check]
        changes: dict[ListingChange, list[Listing]] = defaultdict(list)
        for raw in raws:
            change, listing = self._absorb(source_id, raw, checked_at)
            changes[change].append(listing)
        outcome = CheckOutcome.PARTIAL if feed.skipped else CheckOutcome.SUCCEEDED
        return SourceCheck(source_id, outcome, checked_at, found=len(raws), changes=dict(changes))

    def listings(self) -> list[Listing]:
        return self._catalog.list_all()

    def _absorb(self, source_id: str, raw: RawListing, at: str) -> tuple[ListingChange, Listing]:
        url = canonical_url(raw.url)
        fingerprint = listing_fingerprint(raw.organization, raw.title, raw.location)
        existing = self._catalog.find_by_url(url) or self._catalog.find_by_fingerprint(fingerprint)
        if existing is None:
            listing = self._new_listing(source_id, raw, url, fingerprint, at)
            self._catalog.save(listing)
            return ListingChange.NEW, listing
        content_hash = self._content_hash(raw)
        changed = content_hash != existing.content_hash
        updated = existing.model_copy(
            update={
                "sources": self._merge_source(existing.sources, source_id, url, raw.published_at, at),
                "versions": [*existing.versions, self._version(raw, content_hash, at)] if changed else existing.versions,
                "description": raw.description if changed else existing.description,
                "last_checked_at": at,
            }
        )
        self._catalog.save(updated)
        return (ListingChange.UPDATED if changed else ListingChange.UNCHANGED), updated

    def _new_listing(self, source_id: str, raw: RawListing, url: str, fingerprint: str, at: str) -> Listing:
        warnings = self._screen.screen(raw)
        return Listing(
            id=self._ids.next(LISTING_ID_PREFIX),
            fingerprint=fingerprint,
            type=raw.type,
            title=raw.title,
            organization=raw.organization,
            location=raw.location,
            country_code=raw.country_code,
            work_arrangement=raw.work_arrangement,
            deadline=raw.deadline,
            description=raw.description,
            status=OpportunityStatus.FLAGGED if warnings else OpportunityStatus.ACTIVE,
            warnings=warnings,
            sources=[ListingSource(source_id=source_id, url=url, first_seen_at=at, last_seen_at=at, published_at=raw.published_at)],
            versions=[self._version(raw, self._content_hash(raw), at)],
            discovered_at=at,
            last_checked_at=at,
        )

    @staticmethod
    def _merge_source(sources: list[ListingSource], source_id: str, url: str, published_at: str | None, at: str) -> list[ListingSource]:
        if any(s.url == url for s in sources):
            return [s.model_copy(update={"last_seen_at": at}) if s.url == url else s for s in sources]
        return [*sources, ListingSource(source_id=source_id, url=url, first_seen_at=at, last_seen_at=at, published_at=published_at)]

    @staticmethod
    def _content_hash(raw: RawListing) -> str:
        return digest(raw.title, raw.description, raw.deadline or "")

    @staticmethod
    def _version(raw: RawListing, content_hash: str, at: str) -> CircularVersion:
        return CircularVersion(observed_at=at, content_hash=content_hash, text=raw.description)
