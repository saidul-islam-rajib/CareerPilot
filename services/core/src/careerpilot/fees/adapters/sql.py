from sqlalchemy import Select, String
from sqlalchemy.orm import Mapped, Session, mapped_column

from careerpilot.fees.enums import RecordKind
from careerpilot.platform.clock import Clock
from careerpilot.platform.persistence import ID_LENGTH, SHORT_TEXT, Audited, Base, Database, active


class FeeRecordRow(Audited, Base):
    __tablename__ = "fee_records"

    id: Mapped[str] = mapped_column(String(ID_LENGTH), primary_key=True)
    user_id: Mapped[str] = mapped_column(String(ID_LENGTH), index=True)
    record_kind: Mapped[str] = mapped_column(String(SHORT_TEXT), index=True)
    document: Mapped[dict[str, object]]


class SqlFeeRecords:
    def __init__(self, database: Database, clock: Clock) -> None:
        self._db = database
        self._clock = clock

    def _mine(self, user_id: str, kind: RecordKind) -> Select[tuple[FeeRecordRow]]:
        return active(FeeRecordRow).where(FeeRecordRow.user_id == user_id, FeeRecordRow.record_kind == kind.value)

    def get(self, user_id: str, kind: RecordKind, record_id: str) -> dict[str, object] | None:
        with self._db.unit_of_work() as session:
            row = session.scalars(self._mine(user_id, kind).where(FeeRecordRow.id == record_id)).first()
            return dict(row.document) if row else None

    def for_user(self, user_id: str, kind: RecordKind) -> list[dict[str, object]]:
        with self._db.unit_of_work() as session:
            return [dict(row.document) for row in session.scalars(self._mine(user_id, kind).order_by(FeeRecordRow.created_at))]

    def save(self, user_id: str, kind: RecordKind, record_id: str, document: dict[str, object]) -> None:
        def change(session: Session) -> None:
            row = session.scalars(self._mine(user_id, kind).where(FeeRecordRow.id == record_id)).first()
            if row is None:
                session.add(FeeRecordRow(id=record_id, user_id=user_id, record_kind=kind.value, document=document))
                return
            row.document = document

        self._db.write(change)

    def remove(self, user_id: str, kind: RecordKind, record_id: str, reason: str) -> None:
        def change(session: Session) -> None:
            for row in session.scalars(self._mine(user_id, kind).where(FeeRecordRow.id == record_id)):
                row.soft_delete(self._clock, reason)

        self._db.write(change)
