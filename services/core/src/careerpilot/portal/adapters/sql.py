from sqlalchemy import Select, String
from sqlalchemy.orm import Mapped, Session, mapped_column

from careerpilot.platform.clock import Clock, IdGenerator
from careerpilot.platform.persistence import ID_LENGTH, SHORT_TEXT, Audited, Base, Database, active
from careerpilot.portal.enums import RecordKind

ROW_PREFIX = "por"


class PortalRecordRow(Audited, Base):
    __tablename__ = "portal_records"

    id: Mapped[str] = mapped_column(String(ID_LENGTH), primary_key=True)
    user_id: Mapped[str] = mapped_column(String(ID_LENGTH), index=True)
    record_kind: Mapped[str] = mapped_column(String(SHORT_TEXT), index=True)
    record_key: Mapped[str] = mapped_column(String(ID_LENGTH), index=True)
    document: Mapped[dict[str, object]]


class SqlPortalRecords:
    def __init__(self, database: Database, clock: Clock, ids: IdGenerator) -> None:
        self._db = database
        self._clock = clock
        self._ids = ids

    def _of_kind(self, kind: RecordKind) -> Select[tuple[PortalRecordRow]]:
        return active(PortalRecordRow).where(PortalRecordRow.record_kind == kind.value)

    def _mine(self, user_id: str, kind: RecordKind) -> Select[tuple[PortalRecordRow]]:
        return self._of_kind(kind).where(PortalRecordRow.user_id == user_id)

    def get(self, user_id: str, kind: RecordKind, record_id: str) -> dict[str, object] | None:
        with self._db.unit_of_work() as session:
            row = session.scalars(self._mine(user_id, kind).where(PortalRecordRow.record_key == record_id)).first()
            return dict(row.document) if row else None

    def for_user(self, user_id: str, kind: RecordKind) -> list[dict[str, object]]:
        with self._db.unit_of_work() as session:
            return [dict(row.document) for row in session.scalars(self._mine(user_id, kind).order_by(PortalRecordRow.created_at))]

    def all_of_kind(self, kind: RecordKind) -> list[tuple[str, dict[str, object]]]:
        with self._db.unit_of_work() as session:
            return [(row.user_id, dict(row.document)) for row in session.scalars(self._of_kind(kind).order_by(PortalRecordRow.created_at))]

    def save(self, user_id: str, kind: RecordKind, record_id: str, document: dict[str, object]) -> None:
        def change(session: Session) -> None:
            row = session.scalars(self._mine(user_id, kind).where(PortalRecordRow.record_key == record_id)).first()
            if row is None:
                row_id = self._ids.next(ROW_PREFIX)
                session.add(PortalRecordRow(id=row_id, user_id=user_id, record_kind=kind.value, record_key=record_id, document=document))
                return
            row.document = document

        self._db.write(change)

    def remove(self, user_id: str, kind: RecordKind, record_id: str, reason: str) -> None:
        def change(session: Session) -> None:
            for row in session.scalars(self._mine(user_id, kind).where(PortalRecordRow.record_key == record_id)):
                row.soft_delete(self._clock, reason)

        self._db.write(change)
