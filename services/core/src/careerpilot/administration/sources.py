from collections.abc import Callable
from dataclasses import dataclass
from urllib.parse import urlsplit

from careerpilot.administration.models import AdminSourceRow, NewSource, SourceDefaults, SourceSetup
from careerpilot.administration.ports import Directory
from careerpilot.discovery.models import Listing
from careerpilot.discovery.resolver import ResolvedSource
from careerpilot.platform.config import ListingDefaults, SourceDefinition, SuggestedSource
from careerpilot.platform.enums import SourceReview

SourceLookup = Callable[[str], ResolvedSource | None]
SITE_PREFIX = "www."
SOURCE_ID_PREFIX = "src"
LINK_SOURCE_PREFIX = "link:"


def nothing_found(_link: str) -> ResolvedSource | None:
    return None


@dataclass(frozen=True)
class SourcePolicy:
    connectors: frozenset[str]
    check_address: Callable[[str], str | None]
    suggestions: list[SuggestedSource]
    resolve: SourceLookup = nothing_found

    def resolved_setup(self, site_url: str, defaults: SourceDefaults) -> tuple[SourceSetup, str] | None:
        found = self.resolve(site_url)
        url = self.check_address(found.url) if found is not None else None
        if found is None or url is None:
            return None
        organization = defaults.organization or found.name
        setup = SourceSetup(
            connector=found.connector,
            url=url,
            site_url=site_url,
            defaults=defaults.model_copy(update={"organization": organization}),
        )
        return setup, found.name

    def healed(self, setup: SourceSetup) -> SourceSetup | None:
        resolved = self.resolved_setup(setup.site_url or setup.url, setup.defaults)
        return resolved[0] if resolved is not None else None


def definition_from_setup(setup: SourceSetup) -> SourceDefinition:
    defaults = setup.defaults
    return SourceDefinition(
        connector=setup.connector,
        url=setup.url,
        defaults=ListingDefaults(
            type=defaults.type.value,
            work_arrangement=defaults.work_arrangement.value,
            country_code=defaults.country_code,
            location=defaults.location,
            organization=defaults.organization,
        ),
    )


def directory_definitions(directory: Directory) -> dict[str, SourceDefinition]:
    return {row.id: definition_from_setup(row.setup) for row in directory.sources() if row.setup is not None}


def new_source_from_suggestion(suggestion: SuggestedSource) -> NewSource:
    return NewSource(
        name=suggestion.name,
        connector=suggestion.connector,
        url=suggestion.url,
        defaults=SourceDefaults.model_validate(suggestion.defaults.model_dump()),
    )


def address_key(url: str) -> str:
    parts = urlsplit(url.strip().lower())
    host = (parts.hostname or "").removeprefix(SITE_PREFIX)
    path = parts.path.rstrip("/")
    return f"{host}{path}?{parts.query}" if parts.query else f"{host}{path}"


def same_address(left: str, right: str) -> bool:
    return bool(left.strip()) and bool(right.strip()) and address_key(left) == address_key(right)


def source_at(rows: list[AdminSourceRow], *urls: str) -> AdminSourceRow | None:
    for row in rows:
        setup = row.setup
        if setup is not None and any(same_address(known, url) for known in (setup.url, setup.site_url) for url in urls):
            return row
    return None


def is_shared(row: AdminSourceRow) -> bool:
    return row.review is SourceReview.APPROVED


def link_source_id(user_id: str) -> str:
    return f"{LINK_SOURCE_PREFIX}{user_id}"


def is_link_source(source_id: str) -> bool:
    return source_id.startswith(LINK_SOURCE_PREFIX)


def listing_visibility(sources: Callable[[], list[AdminSourceRow]]) -> Callable[[str], Callable[[Listing], bool]]:
    def for_user(user_id: str) -> Callable[[Listing], bool]:
        private = {row.id: set(row.owner_ids) for row in sources() if not is_shared(row)}
        own_links = link_source_id(user_id)

        def open_to_user(source_id: str) -> bool:
            if is_link_source(source_id):
                return source_id == own_links
            return source_id not in private or user_id in private[source_id]

        def visible(listing: Listing) -> bool:
            return any(open_to_user(source.source_id) for source in listing.sources)

        return visible

    return for_user


def no_follow_up() -> int:
    return 0
