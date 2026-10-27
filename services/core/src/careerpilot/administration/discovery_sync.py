from collections.abc import Callable

from careerpilot.administration.models import AdminOpportunityRow, AdminSourceRow
from careerpilot.administration.ports import Directory
from careerpilot.discovery.models import CheckOutcome, Listing, ListingChange, SourceCheck
from careerpilot.discovery.service import DiscoveryService
from careerpilot.platform.enums import SourceStatus
from careerpilot.platform.errors import conflict, not_found

NO_APPLICATIONS = 0


def opportunity_row(listing: Listing) -> AdminOpportunityRow:
    return AdminOpportunityRow(
        id=listing.id,
        title=listing.title,
        organization=listing.organization,
        country_code=listing.country_code,
        type=listing.type,
        status=listing.status,
        discovered_at=listing.discovered_at,
        applications_count=NO_APPLICATIONS,
    )


def source_row_after(row: AdminSourceRow, check: SourceCheck, failing_after: int) -> AdminSourceRow:
    found = row.opportunities_found + len(check.listings(ListingChange.NEW))
    if check.outcome is CheckOutcome.FAILED:
        failures = row.failures_last24h + 1
        status = SourceStatus.FAILING if failures >= failing_after else SourceStatus.DEGRADED
        return row.model_copy(update={"failures_last24h": failures, "status": status})
    status = SourceStatus.HEALTHY if check.outcome is CheckOutcome.SUCCEEDED else SourceStatus.DEGRADED
    return row.model_copy(
        update={"last_success_at": check.checked_at, "failures_last24h": 0, "status": status, "opportunities_found": found}
    )


def apply_check(directory: Directory, row: AdminSourceRow, check: SourceCheck, failing_after: int) -> AdminSourceRow:
    for listing in check.listings(ListingChange.NEW):
        directory.save_opportunity(opportunity_row(listing))
    updated = source_row_after(row, check, failing_after)
    directory.save_source(updated)
    return updated


def discover_when_empty(discovery: DiscoveryService, directory: Directory, failing_after: int) -> bool:
    if discovery.listings():
        return False
    for row in directory.sources():
        if row.enabled and discovery.is_configured(row.id):
            apply_check(directory, row, discovery.run(row.id), failing_after)
    return True


class SourceCheckRunner:
    def __init__(
        self, discovery: DiscoveryService, directory: Directory, failing_after: int, on_new_listings: Callable[[], object]
    ) -> None:
        self._discovery = discovery
        self._directory = directory
        self._failing_after = failing_after
        self._on_new_listings = on_new_listings

    def due_sources(self) -> list[str]:
        return [row.id for row in self._directory.sources() if row.enabled and self._discovery.is_configured(row.id)]

    def check(self, source_id: str) -> tuple[AdminSourceRow, SourceCheck]:
        row = next((s for s in self._directory.sources() if s.id == source_id), None)
        if row is None:
            raise not_found("source")
        if not row.enabled:
            raise conflict("source_disabled")
        check = self._discovery.run(source_id)
        updated = apply_check(self._directory, row, check, self._failing_after)
        if check.listings(ListingChange.NEW):
            self._on_new_listings()
        return updated, check
