from datetime import datetime
from enum import StrEnum
from typing import Any, TypeVar

from pydantic import BaseModel
from sqlalchemy import Boolean, DateTime, Integer, String, func, select
from sqlalchemy.orm import Mapped, mapped_column

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
from careerpilot.platform.clock import iso, parse_iso
from careerpilot.platform.enums import ActorType, AdminRole
from careerpilot.platform.persistence import ID_LENGTH, SHORT_TEXT, TEXT, Audited, Base, Database, active

PLATFORM_SETTINGS_ID = "platform"
OPERATIONS_ID = "operations"

Model = TypeVar("Model", bound=BaseModel)


class ProjectionKind(StrEnum):
    USER = "user"
    APPLICATION = "application"
    OPPORTUNITY = "opportunity"
    SOURCE = "source"
    OPERATIONS = "operations"


class AdminAccountRow(Audited, Base):
    __tablename__ = "admin_accounts"

    id: Mapped[str] = mapped_column(String(ID_LENGTH), primary_key=True)
    email: Mapped[str] = mapped_column(String(TEXT), unique=True)
    full_name: Mapped[str] = mapped_column(String(TEXT))
    role: Mapped[str] = mapped_column(String(SHORT_TEXT))
    suspended: Mapped[bool] = mapped_column(Boolean)
    mfa_enabled: Mapped[bool] = mapped_column(Boolean)
    last_sign_in_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), default=None)
    password_hash: Mapped[str] = mapped_column(String(TEXT))


class PlatformSettingsRow(Audited, Base):
    __tablename__ = "platform_settings"

    id: Mapped[str] = mapped_column(String(ID_LENGTH), primary_key=True)
    document: Mapped[dict[str, object]]


class AuditEventRow(Audited, Base):
    __tablename__ = "audit_events"

    id: Mapped[str] = mapped_column(String(ID_LENGTH), primary_key=True)
    at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    actor_name: Mapped[str] = mapped_column(String(TEXT))
    actor_type: Mapped[str] = mapped_column(String(SHORT_TEXT))
    action: Mapped[str] = mapped_column(String(TEXT))
    target: Mapped[str] = mapped_column(String(TEXT))


class AdminProjectionRow(Audited, Base):
    __tablename__ = "admin_projections"

    kind: Mapped[str] = mapped_column(String(SHORT_TEXT), primary_key=True)
    id: Mapped[str] = mapped_column(String(ID_LENGTH), primary_key=True)
    sequence: Mapped[int] = mapped_column(Integer)
    document: Mapped[dict[str, object]]


def _account(row: AdminAccountRow) -> AdminCredential:
    return AdminCredential(
        account=AdminAccount(
            id=row.id,
            full_name=row.full_name,
            email=row.email,
            role=AdminRole(row.role),
            suspended=row.suspended,
            mfa_enabled=row.mfa_enabled,
            last_sign_in_at=iso(row.last_sign_in_at) if row.last_sign_in_at else None,
        ),
        password_hash=row.password_hash,
    )


class SqlAdminAccountRepository:
    def __init__(self, database: Database) -> None:
        self._db = database

    def find_by_email(self, email: str) -> AdminCredential | None:
        with self._db.unit_of_work() as session:
            row = session.scalars(active(AdminAccountRow).where(AdminAccountRow.email == email.strip().lower())).first()
            return _account(row) if row else None

    def get(self, admin_id: str) -> AdminCredential | None:
        with self._db.unit_of_work() as session:
            row = session.scalars(active(AdminAccountRow).where(AdminAccountRow.id == admin_id)).first()
            return _account(row) if row else None

    def list_all(self) -> list[AdminAccount]:
        with self._db.unit_of_work() as session:
            return [_account(r).account for r in session.scalars(active(AdminAccountRow).order_by(AdminAccountRow.email))]

    def save(self, credential: AdminCredential) -> None:
        account = credential.account
        values: dict[str, Any] = {
            "email": account.email.lower(),
            "full_name": account.full_name,
            "role": account.role.value,
            "suspended": account.suspended,
            "mfa_enabled": account.mfa_enabled,
            "last_sign_in_at": parse_iso(account.last_sign_in_at) if account.last_sign_in_at else None,
            "password_hash": credential.password_hash,
        }
        with self._db.unit_of_work() as session:
            row = session.get(AdminAccountRow, account.id)
            if row is None:
                session.add(AdminAccountRow(id=account.id, **values))
                return
            for key, value in values.items():
                setattr(row, key, value)


class SqlPlatformSettingsRepository:
    def __init__(self, database: Database) -> None:
        self._db = database

    def get(self) -> PlatformSettings:
        with self._db.unit_of_work() as session:
            row = session.get(PlatformSettingsRow, PLATFORM_SETTINGS_ID)
            if row is None:
                raise LookupError(PLATFORM_SETTINGS_ID)
            return PlatformSettings.model_validate(row.document)

    def save(self, settings: PlatformSettings) -> None:
        with self._db.unit_of_work() as session:
            row = session.get(PlatformSettingsRow, PLATFORM_SETTINGS_ID)
            if row is None:
                session.add(PlatformSettingsRow(id=PLATFORM_SETTINGS_ID, document=settings.to_json()))
            else:
                row.document = settings.to_json()


class SqlAuditLog:
    def __init__(self, database: Database) -> None:
        self._db = database

    def append(self, entry: AuditEntry) -> None:
        with self._db.unit_of_work() as session:
            session.add(
                AuditEventRow(
                    id=entry.id,
                    at=parse_iso(entry.at),
                    actor_name=entry.actor_name,
                    actor_type=entry.actor_type.value,
                    action=entry.action,
                    target=entry.target,
                )
            )

    def list_all(self) -> list[AuditEntry]:
        with self._db.unit_of_work() as session:
            rows = session.scalars(select(AuditEventRow).order_by(AuditEventRow.at.desc(), AuditEventRow.created_at.desc()))
            return [
                AuditEntry(
                    id=r.id, at=iso(r.at), actor_name=r.actor_name, actor_type=ActorType(r.actor_type), action=r.action, target=r.target
                )
                for r in rows
            ]


class SqlDirectory:
    def __init__(self, database: Database) -> None:
        self._db = database

    def users(self) -> list[AdminUserRow]:
        return self._list(ProjectionKind.USER, AdminUserRow)

    def save_user(self, row: AdminUserRow) -> None:
        self._save(ProjectionKind.USER, row.id, row)

    def applications(self) -> list[AdminApplicationRow]:
        return self._list(ProjectionKind.APPLICATION, AdminApplicationRow)

    def save_application(self, row: AdminApplicationRow) -> None:
        self._save(ProjectionKind.APPLICATION, row.id, row)

    def opportunities(self) -> list[AdminOpportunityRow]:
        return self._list(ProjectionKind.OPPORTUNITY, AdminOpportunityRow)

    def save_opportunity(self, row: AdminOpportunityRow) -> None:
        self._save(ProjectionKind.OPPORTUNITY, row.id, row)

    def sources(self) -> list[AdminSourceRow]:
        return self._list(ProjectionKind.SOURCE, AdminSourceRow)

    def save_source(self, row: AdminSourceRow) -> None:
        self._save(ProjectionKind.SOURCE, row.id, row)

    def operations(self) -> OperationsSnapshot:
        with self._db.unit_of_work() as session:
            row = session.get(AdminProjectionRow, (ProjectionKind.OPERATIONS.value, OPERATIONS_ID))
            if row is None:
                raise LookupError(OPERATIONS_ID)
            return operations_from_document(dict(row.document))

    def save_operations(self, document: dict[str, object]) -> None:
        with self._db.unit_of_work() as session:
            session.add(AdminProjectionRow(kind=ProjectionKind.OPERATIONS.value, id=OPERATIONS_ID, sequence=1, document=document))

    def _list(self, kind: ProjectionKind, model: type[Model]) -> list[Model]:
        with self._db.unit_of_work() as session:
            rows = session.scalars(
                active(AdminProjectionRow).where(AdminProjectionRow.kind == kind.value).order_by(AdminProjectionRow.sequence)
            )
            return [model.model_validate(r.document) for r in rows]

    def _save(self, kind: ProjectionKind, row_id: str, model: BaseModel) -> None:
        document: dict[str, object] = model.model_dump(mode="json", by_alias=True, exclude_none=True)
        with self._db.unit_of_work() as session:
            row = session.get(AdminProjectionRow, (kind.value, row_id))
            if row is None:
                count = (
                    session.scalar(select(func.count()).select_from(AdminProjectionRow).where(AdminProjectionRow.kind == kind.value)) or 0
                )
                session.add(AdminProjectionRow(kind=kind.value, id=row_id, sequence=count + 1, document=document))
            else:
                row.document = document
