from collections.abc import Callable
from dataclasses import dataclass

from careerpilot.administration.models import NewSource, SourceDefaults, SourceSetup
from careerpilot.administration.ports import Directory
from careerpilot.platform.config import ListingDefaults, SourceDefinition, SuggestedSource


@dataclass(frozen=True)
class SourcePolicy:
    connectors: frozenset[str]
    check_address: Callable[[str], str | None]
    suggestions: list[SuggestedSource]


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
