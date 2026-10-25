from temporalio import activity

from careerpilot.bootstrap import Container
from careerpilot.discovery.models import ListingChange
from careerpilot.platform.errors import DomainError
from careerpilot_workers.workflows import CHECK_SOURCE, DUE_SOURCES, SourceCheckResult


class DiscoveryActivities:
    def __init__(self, container: Container) -> None:
        self._container = container

    @activity.defn(name=DUE_SOURCES)
    def due_sources(self) -> list[str]:
        return self._container.source_checks.due_sources()

    @activity.defn(name=CHECK_SOURCE)
    def check_source(self, source_id: str) -> SourceCheckResult:
        try:
            _, check = self._container.source_checks.check(source_id)
        except DomainError as error:
            return SourceCheckResult(source_id=source_id, outcome=None, new_listings=0, error=error.detail or error.code.value)
        return SourceCheckResult(
            source_id=source_id,
            outcome=check.outcome.value,
            new_listings=len(check.listings(ListingChange.NEW)),
            error=check.error,
        )
