from collections import Counter
from collections.abc import Callable
from typing import Protocol

from careerpilot.administration.discovery_sync import live_opportunities
from careerpilot.administration.models import AdminApplicationRow, AdminOpportunityRow, AdminSourceRow, AdminUserRow
from careerpilot.administration.ports import Directory
from careerpilot.administration.user_records import AdminUserRecords
from careerpilot.discovery.models import Listing


class Figures(Protocol):
    def users(self) -> list[AdminUserRow]: ...

    def applications(self) -> list[AdminApplicationRow]: ...

    def opportunities(self) -> list[AdminOpportunityRow]: ...

    def sources(self) -> list[AdminSourceRow]: ...


class DirectoryFigures:
    def __init__(self, directory: Directory) -> None:
        self._directory = directory

    def users(self) -> list[AdminUserRow]:
        return self._directory.users()

    def applications(self) -> list[AdminApplicationRow]:
        return self._directory.applications()

    def opportunities(self) -> list[AdminOpportunityRow]:
        return self._directory.opportunities()

    def sources(self) -> list[AdminSourceRow]:
        return self._directory.sources()


class LiveFigures:
    def __init__(self, records: AdminUserRecords, directory: Directory, listings: Callable[[], list[Listing]]) -> None:
        self._records = records
        self._directory = directory
        self._listings = listings

    def users(self) -> list[AdminUserRow]:
        return self._records.rows()

    def applications(self) -> list[AdminApplicationRow]:
        return self._records.application_rows()

    def opportunities(self) -> list[AdminOpportunityRow]:
        return live_opportunities(self._directory, self._listings, dict(Counter(self._records.applied_opportunity_ids())))

    def sources(self) -> list[AdminSourceRow]:
        return self._directory.sources()
