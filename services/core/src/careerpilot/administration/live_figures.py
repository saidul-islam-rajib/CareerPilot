from collections import Counter
from collections.abc import Callable
from dataclasses import dataclass
from typing import Protocol

from careerpilot.administration.discovery_sync import live_opportunities
from careerpilot.administration.models import AdminApplicationRow, AdminOpportunityRow, AdminSourceRow, AdminUserRow
from careerpilot.administration.ports import Directory
from careerpilot.administration.user_records import AdminUserRecords
from careerpilot.discovery.models import Listing


@dataclass(frozen=True)
class DashboardFilter:
    date_from: str | None = None
    date_to: str | None = None
    country: str | None = None
    track: str | None = None
    user_id: str | None = None


ISO_DATE_LENGTH = 10


def _in_dates(stamp: str, query: DashboardFilter) -> bool:
    day = stamp[:ISO_DATE_LENGTH]
    return (not query.date_from or day >= query.date_from) and (not query.date_to or day <= query.date_to)


def filter_users(users: list[AdminUserRow], query: DashboardFilter) -> list[AdminUserRow]:
    return [
        u
        for u in users
        if _in_dates(u.created_at, query)
        and (not query.country or u.country.lower() == query.country.lower())
        and (not query.track or query.track in u.track_kinds)
        and (not query.user_id or u.id == query.user_id)
    ]


def filter_applications(
    applications: list[AdminApplicationRow], users: list[AdminUserRow], query: DashboardFilter
) -> list[AdminApplicationRow]:
    narrowed_users = bool(query.country or query.track or query.user_id)
    ids = {u.id for u in filter_users(users, DashboardFilter(None, None, query.country, query.track, query.user_id))}
    names = {u.full_name for u in users if u.id in ids}
    return [
        a
        for a in applications
        if _in_dates(a.updated_at, query) and (not narrowed_users or a.user_id in ids or (not a.user_id and a.user_name in names))
    ]


class Figures(Protocol):
    def users(self, query: DashboardFilter) -> list[AdminUserRow]: ...

    def applications(self, query: DashboardFilter) -> list[AdminApplicationRow]: ...

    def opportunities(self) -> list[AdminOpportunityRow]: ...

    def sources(self) -> list[AdminSourceRow]: ...


class DirectoryFigures:
    def __init__(self, directory: Directory) -> None:
        self._directory = directory

    def users(self, query: DashboardFilter) -> list[AdminUserRow]:
        return filter_users(self._directory.users(), query)

    def applications(self, query: DashboardFilter) -> list[AdminApplicationRow]:
        return filter_applications(self._directory.applications(), self._directory.users(), query)

    def opportunities(self) -> list[AdminOpportunityRow]:
        return self._directory.opportunities()

    def sources(self) -> list[AdminSourceRow]:
        return self._directory.sources()


class LiveFigures:
    def __init__(self, records: AdminUserRecords, directory: Directory, listings: Callable[[], list[Listing]]) -> None:
        self._records = records
        self._directory = directory
        self._listings = listings

    def users(self, query: DashboardFilter) -> list[AdminUserRow]:
        return filter_users(self._records.rows(), query)

    def applications(self, query: DashboardFilter) -> list[AdminApplicationRow]:
        return filter_applications(self._records.application_rows(), self._records.rows(), query)

    def opportunities(self) -> list[AdminOpportunityRow]:
        return live_opportunities(self._directory, self._listings, dict(Counter(self._records.applied_opportunity_ids())))

    def sources(self) -> list[AdminSourceRow]:
        return self._directory.sources()
