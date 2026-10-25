import copy
from typing import Any, TypeVar

from careerpilot.administration.adapters.documents import operations_from_document
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
from careerpilot.platform.security import PasswordHasher


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
    return [row if r.id == row.id else r for r in rows]


class InMemoryDirectory:
    def __init__(self, seed: dict[str, Any]) -> None:
        self._users = [AdminUserRow.model_validate(u) for u in seed["users"]]
        self._applications = [AdminApplicationRow.model_validate(a) for a in seed["applications"]]
        self._opportunities = [AdminOpportunityRow.model_validate(o) for o in seed["opportunities"]]
        self._sources = [AdminSourceRow.model_validate(s) for s in seed["sources"]]
        self._operations = operations_from_document(seed)

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


def admin_credentials_from_seed(seed: dict[str, Any], hasher: PasswordHasher) -> list[AdminCredential]:
    return [
        AdminCredential(account=AdminAccount.model_validate(a["account"]), password_hash=hasher.hash(str(a["password"])))
        for a in seed["admins"]
    ]


def audit_from_seed(seed: dict[str, Any]) -> list[AuditEntry]:
    return [AuditEntry.model_validate(e) for e in seed["audit"]]


def platform_settings_from_seed(seed: dict[str, Any]) -> PlatformSettings:
    return PlatformSettings.model_validate(seed["settings"])
