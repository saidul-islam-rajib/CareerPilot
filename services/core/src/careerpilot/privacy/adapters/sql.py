from sqlalchemy import String
from sqlalchemy.orm import Mapped, Session, mapped_column

from careerpilot.platform.persistence import ID_LENGTH, SHORT_TEXT, Audited, Base, Database, active
from careerpilot.privacy.enums import DeletionStatus, ExportStatus
from careerpilot.privacy.models import ConsentRecord, DeletionRecord, ExportRequest


class DataExportRow(Audited, Base):
    __tablename__ = "data_exports"

    id: Mapped[str] = mapped_column(String(ID_LENGTH), primary_key=True)
    user_id: Mapped[str] = mapped_column(String(ID_LENGTH), index=True)
    status: Mapped[str] = mapped_column(String(SHORT_TEXT), index=True)
    requested_at: Mapped[str] = mapped_column(String(SHORT_TEXT), index=True)
    document: Mapped[dict[str, object]]


class AccountDeletionRow(Audited, Base):
    __tablename__ = "account_deletions"

    id: Mapped[str] = mapped_column(String(ID_LENGTH), primary_key=True)
    user_id: Mapped[str] = mapped_column(String(ID_LENGTH), index=True)
    status: Mapped[str] = mapped_column(String(SHORT_TEXT), index=True)
    requested_at: Mapped[str] = mapped_column(String(SHORT_TEXT), index=True)
    document: Mapped[dict[str, object]]


class ConsentRow(Audited, Base):
    __tablename__ = "consent_records"

    id: Mapped[str] = mapped_column(String(ID_LENGTH), primary_key=True)
    user_id: Mapped[str] = mapped_column(String(ID_LENGTH), index=True)
    kind: Mapped[str] = mapped_column(String(SHORT_TEXT))
    at: Mapped[str] = mapped_column(String(SHORT_TEXT), index=True)
    document: Mapped[dict[str, object]]


def _json(model: ExportRequest | DeletionRecord | ConsentRecord) -> dict[str, object]:
    return model.model_dump(mode="json", by_alias=True, exclude_none=True)


class SqlExportRepository:
    def __init__(self, database: Database) -> None:
        self._db = database

    def save(self, request: ExportRequest) -> None:
        def change(session: Session) -> None:
            row = session.get(DataExportRow, request.id)
            if row is None:
                session.add(
                    DataExportRow(
                        id=request.id,
                        user_id=request.user_id,
                        status=request.status.value,
                        requested_at=request.requested_at,
                        document=_json(request),
                    )
                )
                return
            row.status = request.status.value
            row.document = _json(request)

        self._db.write(change)

    def get(self, request_id: str) -> ExportRequest | None:
        with self._db.unit_of_work() as session:
            row = session.scalar(active(DataExportRow).where(DataExportRow.id == request_id))
            return ExportRequest.model_validate(row.document) if row else None

    def for_user(self, user_id: str) -> list[ExportRequest]:
        with self._db.unit_of_work() as session:
            rows = session.scalars(
                active(DataExportRow).where(DataExportRow.user_id == user_id).order_by(DataExportRow.requested_at.desc())
            )
            return [ExportRequest.model_validate(r.document) for r in rows]

    def with_status(self, status: ExportStatus) -> list[ExportRequest]:
        with self._db.unit_of_work() as session:
            rows = session.scalars(active(DataExportRow).where(DataExportRow.status == status.value))
            return [ExportRequest.model_validate(r.document) for r in rows]

    def recent(self, limit: int) -> list[ExportRequest]:
        with self._db.unit_of_work() as session:
            rows = session.scalars(active(DataExportRow).order_by(DataExportRow.requested_at.desc()).limit(limit))
            return [ExportRequest.model_validate(r.document) for r in rows]


class SqlDeletionRepository:
    def __init__(self, database: Database) -> None:
        self._db = database

    def save(self, record: DeletionRecord) -> None:
        def change(session: Session) -> None:
            row = session.get(AccountDeletionRow, record.id)
            if row is None:
                session.add(
                    AccountDeletionRow(
                        id=record.id,
                        user_id=record.user_id,
                        status=record.status.value,
                        requested_at=record.requested_at,
                        document=_json(record),
                    )
                )
                return
            row.status = record.status.value
            row.document = _json(record)

        self._db.write(change)

    def latest(self, user_id: str) -> DeletionRecord | None:
        with self._db.unit_of_work() as session:
            query = active(AccountDeletionRow).where(AccountDeletionRow.user_id == user_id).order_by(AccountDeletionRow.requested_at.desc())
            row = session.scalars(query).first()
            return DeletionRecord.model_validate(row.document) if row else None

    def with_status(self, status: DeletionStatus) -> list[DeletionRecord]:
        with self._db.unit_of_work() as session:
            rows = session.scalars(active(AccountDeletionRow).where(AccountDeletionRow.status == status.value))
            return [DeletionRecord.model_validate(r.document) for r in rows]

    def recent(self, limit: int) -> list[DeletionRecord]:
        with self._db.unit_of_work() as session:
            rows = session.scalars(active(AccountDeletionRow).order_by(AccountDeletionRow.requested_at.desc()).limit(limit))
            return [DeletionRecord.model_validate(r.document) for r in rows]


class SqlConsentRepository:
    def __init__(self, database: Database) -> None:
        self._db = database

    def add(self, record: ConsentRecord) -> None:
        self._db.write(
            lambda session: session.add(
                ConsentRow(id=record.id, user_id=record.user_id, kind=record.kind.value, at=record.at, document=_json(record))
            )
        )

    def for_user(self, user_id: str) -> list[ConsentRecord]:
        with self._db.unit_of_work() as session:
            rows = session.scalars(active(ConsentRow).where(ConsentRow.user_id == user_id).order_by(ConsentRow.at, ConsentRow.id))
            return [ConsentRecord.model_validate(r.document) for r in rows]
