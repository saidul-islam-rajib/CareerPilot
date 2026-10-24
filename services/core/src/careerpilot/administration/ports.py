from dataclasses import dataclass, field
from typing import Protocol

from careerpilot.administration.models import (
    AdminAccount,
    AdminApplicationRow,
    AdminOpportunityRow,
    AdminSourceRow,
    AdminUserRow,
    AuditEntry,
    NotificationCounts,
    PlatformSettings,
    SecretMetadata,
    ServiceStatus,
)


@dataclass
class AdminCredential:
    account: AdminAccount
    password_hash: str


@dataclass
class OperationsSnapshot:
    services: list[ServiceStatus]
    notifications: NotificationCounts
    archived_circulars: int
    user_phones: dict[str, str] = field(default_factory=dict[str, str])
    user_secrets: dict[str, list[SecretMetadata]] = field(default_factory=dict[str, list[SecretMetadata]])


class AdminAccountRepository(Protocol):
    def find_by_email(self, email: str) -> AdminCredential | None: ...

    def get(self, admin_id: str) -> AdminCredential | None: ...

    def list_all(self) -> list[AdminAccount]: ...

    def save(self, credential: AdminCredential) -> None: ...


class PlatformSettingsRepository(Protocol):
    def get(self) -> PlatformSettings: ...

    def save(self, settings: PlatformSettings) -> None: ...


class AuditLog(Protocol):
    def append(self, entry: AuditEntry) -> None: ...

    def list_all(self) -> list[AuditEntry]: ...


class Directory(Protocol):
    def users(self) -> list[AdminUserRow]: ...

    def save_user(self, row: AdminUserRow) -> None: ...

    def applications(self) -> list[AdminApplicationRow]: ...

    def save_application(self, row: AdminApplicationRow) -> None: ...

    def opportunities(self) -> list[AdminOpportunityRow]: ...

    def save_opportunity(self, row: AdminOpportunityRow) -> None: ...

    def sources(self) -> list[AdminSourceRow]: ...

    def save_source(self, row: AdminSourceRow) -> None: ...

    def operations(self) -> OperationsSnapshot: ...
