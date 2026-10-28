from collections.abc import Callable
from datetime import datetime
from typing import Any

from sqlalchemy import DateTime, Index, String, func, select, text
from sqlalchemy.orm import Mapped, Session, mapped_column

from careerpilot.candidate.models import (
    ApplicationRecord,
    ApprovalDetail,
    OpportunityDetail,
    OpportunityMatch,
    Preferences,
    Profile,
    SavedAnswer,
    SignInEvent,
    UserSummary,
)
from careerpilot.candidate.ports import Account, CandidateWorkspace
from careerpilot.platform.clock import iso, parse_iso
from careerpilot.platform.enums import OpportunityDecision, UserAccountStatus
from careerpilot.platform.persistence import ID_LENGTH, SHORT_TEXT, TEXT, Audited, Base, Database, active

ACTIVE_ROWS = text("deleted_at IS NULL")


class UserAccountRow(Audited, Base):
    __tablename__ = "user_accounts"
    __table_args__ = (Index("uq_user_accounts_email_active", "email", unique=True, sqlite_where=ACTIVE_ROWS, postgresql_where=ACTIVE_ROWS),)

    id: Mapped[str] = mapped_column(String(ID_LENGTH), primary_key=True)
    email: Mapped[str] = mapped_column(String(TEXT))
    full_name: Mapped[str] = mapped_column(String(TEXT))
    photo_url: Mapped[str | None] = mapped_column(String(TEXT), default=None)
    password_hash: Mapped[str] = mapped_column(String(TEXT))
    status: Mapped[str] = mapped_column(String(SHORT_TEXT))
    consent_terms_version: Mapped[str | None] = mapped_column(String(SHORT_TEXT), default=None)
    consent_privacy_version: Mapped[str | None] = mapped_column(String(SHORT_TEXT), default=None)
    consent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), default=None)
    consent_ip: Mapped[str | None] = mapped_column(String(TEXT), default=None)
    consent_device: Mapped[str | None] = mapped_column(String(TEXT), default=None)
    credentials_changed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), default=None)


def _moment(value: datetime | None) -> str | None:
    return iso(value) if value else None


def _timestamp(value: str | None) -> datetime | None:
    return parse_iso(value) if value else None


class CandidateWorkspaceRow(Audited, Base):
    __tablename__ = "candidate_workspaces"

    user_id: Mapped[str] = mapped_column(String(ID_LENGTH), primary_key=True)
    document: Mapped[dict[str, object]]


class OpportunityRow(Audited, Base):
    __tablename__ = "opportunities"

    id: Mapped[str] = mapped_column(String(ID_LENGTH), primary_key=True)
    document: Mapped[dict[str, object]]


def _account(row: UserAccountRow) -> Account:
    return Account(
        user=UserSummary(id=row.id, full_name=row.full_name, email=row.email, photo_url=row.photo_url),
        password_hash=row.password_hash,
        status=UserAccountStatus(row.status),
        consent_terms_version=row.consent_terms_version,
        consent_privacy_version=row.consent_privacy_version,
        consent_at=_moment(row.consent_at),
        consent_ip=row.consent_ip,
        consent_device=row.consent_device,
        credentials_changed_at=_moment(row.credentials_changed_at),
    )


class SqlAccountRepository:
    def __init__(self, database: Database) -> None:
        self._db = database

    def find_by_email(self, email: str) -> Account | None:
        with self._db.unit_of_work() as session:
            row = session.scalars(active(UserAccountRow).where(func.lower(UserAccountRow.email) == email.strip().lower())).first()
            return _account(row) if row else None

    def get(self, user_id: str) -> Account | None:
        with self._db.unit_of_work() as session:
            row = session.scalars(active(UserAccountRow).where(UserAccountRow.id == user_id)).first()
            return _account(row) if row else None

    def add(self, account: Account) -> None:
        with self._db.unit_of_work() as session:
            session.add(UserAccountRow(id=account.user.id, **self._values(account)))

    def save(self, account: Account) -> None:
        def change(session: Session) -> None:
            row = session.get(UserAccountRow, account.user.id)
            if row is None:
                session.add(UserAccountRow(id=account.user.id, **self._values(account)))
                return
            for key, value in self._values(account).items():
                setattr(row, key, value)

        self._db.write(change)

    def active_ids(self) -> list[str]:
        with self._db.unit_of_work() as session:
            query = active(UserAccountRow).where(UserAccountRow.status == UserAccountStatus.ACTIVE.value)
            return [row.id for row in session.scalars(query)]

    @staticmethod
    def _values(account: Account) -> dict[str, Any]:
        return {
            "email": account.user.email,
            "full_name": account.user.full_name,
            "photo_url": account.user.photo_url,
            "password_hash": account.password_hash,
            "status": account.status.value,
            "consent_terms_version": account.consent_terms_version,
            "consent_privacy_version": account.consent_privacy_version,
            "consent_at": _timestamp(account.consent_at),
            "consent_ip": account.consent_ip,
            "consent_device": account.consent_device,
            "credentials_changed_at": _timestamp(account.credentials_changed_at),
        }


class SqlOpportunityRepository:
    def __init__(self, database: Database) -> None:
        self._db = database

    def get(self, opportunity_id: str) -> OpportunityDetail | None:
        with self._db.unit_of_work() as session:
            row = session.scalars(active(OpportunityRow).where(OpportunityRow.id == opportunity_id)).first()
            return OpportunityDetail.model_validate(row.document) if row else None

    def list_all(self) -> list[OpportunityDetail]:
        with self._db.unit_of_work() as session:
            return [OpportunityDetail.model_validate(r.document) for r in session.scalars(active(OpportunityRow))]

    def add(self, opportunity: OpportunityDetail) -> None:
        self.save(opportunity)

    def save(self, opportunity: OpportunityDetail) -> None:
        def change(session: Session) -> None:
            row = session.get(OpportunityRow, opportunity.id)
            if row is None:
                session.add(OpportunityRow(id=opportunity.id, document=opportunity.to_json()))
            else:
                row.document = opportunity.to_json()

        self._db.write(change)


def workspace_to_document(workspace: CandidateWorkspace) -> dict[str, object]:
    return {
        "profile": workspace.profile.to_json(),
        "preferences": workspace.preferences.to_json(),
        "trackOpportunities": workspace.track_opportunities,
        "approvals": [a.to_json() for a in workspace.approvals],
        "applications": [a.to_json() for a in workspace.applications],
        "signInEvents": [e.to_json() for e in workspace.sign_in_events],
        "lastCheckedAt": workspace.last_checked_at,
        "decisions": {k: v.value for k, v in workspace.decisions.items()},
        "deletionScheduledFor": workspace.deletion_scheduled_for,
        "matches": {k: v.to_json() for k, v in workspace.matches.items()},
        "lastDigestOn": workspace.last_digest_on,
        "savedAnswers": [a.to_json() for a in workspace.saved_answers],
    }


def workspace_from_document(document: dict[str, Any]) -> CandidateWorkspace:
    return CandidateWorkspace(
        profile=Profile.model_validate(document["profile"]),
        preferences=Preferences.model_validate(document["preferences"]),
        track_opportunities={k: list(v) for k, v in document["trackOpportunities"].items()},
        approvals=[ApprovalDetail.model_validate(a) for a in document["approvals"]],
        applications=[ApplicationRecord.model_validate(a) for a in document["applications"]],
        sign_in_events=[SignInEvent.model_validate(e) for e in document["signInEvents"]],
        last_checked_at=str(document["lastCheckedAt"]),
        decisions={k: OpportunityDecision(v) for k, v in document.get("decisions", {}).items()},
        deletion_scheduled_for=document.get("deletionScheduledFor"),
        matches={k: OpportunityMatch.model_validate(v) for k, v in document.get("matches", {}).items()},
        last_digest_on=document.get("lastDigestOn"),
        saved_answers=[SavedAnswer.model_validate(a) for a in document.get("savedAnswers", [])],
    )


class SqlWorkspaceRepository:
    def __init__(self, database: Database, empty_workspace: Callable[[str], CandidateWorkspace]) -> None:
        self._db = database
        self._empty = empty_workspace

    def get(self, user_id: str) -> CandidateWorkspace:
        with self._db.unit_of_work() as session:
            row = session.scalars(select(CandidateWorkspaceRow).where(CandidateWorkspaceRow.user_id == user_id)).first()
            if row is not None:
                return workspace_from_document(dict(row.document))
        workspace = self._empty(user_id)
        self.save(user_id, workspace)
        return workspace

    def save(self, user_id: str, workspace: CandidateWorkspace) -> None:
        document = workspace_to_document(workspace)

        def change(session: Session) -> None:
            row = session.get(CandidateWorkspaceRow, user_id)
            if row is None:
                session.add(CandidateWorkspaceRow(user_id=user_id, document=document))
            else:
                row.document = document

        self._db.write(change)
