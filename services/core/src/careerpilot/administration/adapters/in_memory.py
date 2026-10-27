import copy
from typing import TypeVar

from careerpilot.administration.adapters.documents import empty_operations, operations_from_document
from careerpilot.administration.models import (
    AdminAccount,
    AdminApplicationRow,
    AdminOpportunityRow,
    AdminSourceRow,
    AdminUserRow,
    AuditEntry,
    PlatformSettings,
)
from careerpilot.administration.ports import AdminCredential, OperationsSnapshot


class InMemoryAdminAccountRepository:
    def __init__(self, credentials: list[AdminCredential]) -> None:
        self._by_id = {c.account.id: c for c in credentials}

    def find_by_email(self, email: str) -> AdminCredential | None:
        normalized = email.strip().lower()
        return next((copy.deepcopy(c) for c in self._by_id.values() if c.account.email.lower() == normalized), None)

    def get(self, admin_id: str) -> AdminCredential | None:
        found = self._by_id.get(admin_id)
        return copy.deepcopy(found) if found else None

    def list_all(self) -> list[AdminAccount]:
        return [c.account.model_copy() for c in self._by_id.values()]

    def save(self, credential: AdminCredential) -> None:
        self._by_id[credential.account.id] = copy.deepcopy(credential)


class InMemoryPlatformSettingsRepository:
    def __init__(self, settings: PlatformSettings) -> None:
        self._settings = settings

    def get(self) -> PlatformSettings:
        return self._settings.model_copy(deep=True)

    def save(self, settings: PlatformSettings) -> None:
        self._settings = settings.model_copy(deep=True)


class InMemoryAuditLog:
    def __init__(self, entries: list[AuditEntry]) -> None:
        self._entries = list(entries)

    def append(self, entry: AuditEntry) -> None:
        self._entries.insert(0, entry)

    def list_all(self) -> list[AuditEntry]:
        return list(self._entries)


Row = TypeVar("Row", AdminUserRow, AdminApplicationRow, AdminOpportunityRow, AdminSourceRow)


def _replace(rows: list[Row], row: Row) -> list[Row]:
    if all(r.id != row.id for r in rows):
        return [*rows, row]
    return [row if r.id == row.id else r for r in rows]


class InMemoryDirectory:
    def __init__(self) -> None:
        self._users: list[AdminUserRow] = []
        self._applications: list[AdminApplicationRow] = []
        self._opportunities: list[AdminOpportunityRow] = []
        self._sources: list[AdminSourceRow] = []
        self._operations = empty_operations()

    def users(self) -> list[AdminUserRow]:
        return [u.model_copy() for u in self._users]

    def save_user(self, row: AdminUserRow) -> None:
        self._users = _replace(self._users, row)

    def applications(self) -> list[AdminApplicationRow]:
        return [a.model_copy() for a in self._applications]

    def save_application(self, row: AdminApplicationRow) -> None:
        self._applications = _replace(self._applications, row)

    def opportunities(self) -> list[AdminOpportunityRow]:
        return [o.model_copy() for o in self._opportunities]

    def save_opportunity(self, row: AdminOpportunityRow) -> None:
        self._opportunities = _replace(self._opportunities, row)

    def sources(self) -> list[AdminSourceRow]:
        return [s.model_copy() for s in self._sources]

    def save_source(self, row: AdminSourceRow) -> None:
        self._sources = _replace(self._sources, row)

    def operations(self) -> OperationsSnapshot:
        return copy.deepcopy(self._operations)

    def save_operations(self, document: dict[str, object]) -> None:
        self._operations = operations_from_document(dict(document))
