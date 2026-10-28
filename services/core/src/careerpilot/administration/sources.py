from collections.abc import Callable
from dataclasses import dataclass

from careerpilot.administration.models import NewSource, SourceDefaults, SourceSetup
from careerpilot.administration.ports import Directory
from careerpilot.discovery.resolver import ResolvedSource
from careerpilot.platform.config import ListingDefaults, SourceDefinition, SuggestedSource

SourceLookup = Callable[[str], ResolvedSource | None]


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


def same_address(left: str, right: str) -> bool:
    return left.strip().rstrip("/").lower() == right.strip().rstrip("/").lower()
