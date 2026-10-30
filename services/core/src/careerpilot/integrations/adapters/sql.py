from sqlalchemy import String
from sqlalchemy.orm import Mapped, Session, mapped_column

from careerpilot.integrations.models import CalendarEventRecord, ConnectionRecord, SyncedMessage
from careerpilot.platform.clock import Clock
from careerpilot.platform.enums import IntegrationProvider
from careerpilot.platform.persistence import ID_LENGTH, SHORT_TEXT, Audited, Base, Database, active

MESSAGE_ID_LENGTH = 255


class ConnectionRow(Audited, Base):
    __tablename__ = "integration_connections"

    id: Mapped[str] = mapped_column(String(ID_LENGTH), primary_key=True)
    user_id: Mapped[str] = mapped_column(String(ID_LENGTH), index=True)
    provider: Mapped[str] = mapped_column(String(SHORT_TEXT), index=True)
    document: Mapped[dict[str, object]]


class SyncedMessageRow(Audited, Base):
    __tablename__ = "synced_messages"

    id: Mapped[str] = mapped_column(String(ID_LENGTH), primary_key=True)
    user_id: Mapped[str] = mapped_column(String(ID_LENGTH), index=True)
    message_id: Mapped[str] = mapped_column(String(MESSAGE_ID_LENGTH), index=True)
    application_id: Mapped[str] = mapped_column(String(ID_LENGTH), index=True)
    document: Mapped[dict[str, object]]


class CalendarEventRow(Audited, Base):
    __tablename__ = "calendar_events"

    id: Mapped[str] = mapped_column(String(ID_LENGTH), primary_key=True)
    user_id: Mapped[str] = mapped_column(String(ID_LENGTH), index=True)
    task_id: Mapped[str] = mapped_column(String(ID_LENGTH), index=True)
    document: Mapped[dict[str, object]]


def _json(model: ConnectionRecord | SyncedMessage | CalendarEventRecord) -> dict[str, object]:
    return model.model_dump(mode="json", by_alias=True, exclude_none=True)


class SqlConnectionRepository:
    def __init__(self, database: Database, clock: Clock) -> None:
        self._db = database
        self._clock = clock

    def active(self, user_id: str, provider: IntegrationProvider) -> ConnectionRecord | None:
        with self._db.unit_of_work() as session:
            row = session.scalars(
                active(ConnectionRow).where(ConnectionRow.user_id == user_id, ConnectionRow.provider == provider.value)
            ).first()
            return ConnectionRecord.model_validate(row.document) if row else None

    def save(self, record: ConnectionRecord) -> None:
        def change(session: Session) -> None:
            row = session.get(ConnectionRow, record.id)
            if row is None:
                session.add(ConnectionRow(id=record.id, user_id=record.user_id, provider=record.provider.value, document=_json(record)))
                return
            row.restore()
            row.document = _json(record)

        self._db.write(change)

    def remove(self, user_id: str, provider: IntegrationProvider, reason: str) -> None:
        def change(session: Session) -> None:
            query = active(ConnectionRow).where(ConnectionRow.user_id == user_id, ConnectionRow.provider == provider.value)
            for row in session.scalars(query):
                row.soft_delete(self._clock, reason)

        self._db.write(change)

    def all_active(self, provider: IntegrationProvider) -> list[ConnectionRecord]:
        with self._db.unit_of_work() as session:
            rows = session.scalars(active(ConnectionRow).where(ConnectionRow.provider == provider.value))
            return [ConnectionRecord.model_validate(row.document) for row in rows]


class SqlSyncedMessageRepository:
    def __init__(self, database: Database) -> None:
        self._db = database

    def seen(self, user_id: str, message_id: str) -> bool:
        with self._db.unit_of_work() as session:
            query = active(SyncedMessageRow).where(SyncedMessageRow.user_id == user_id, SyncedMessageRow.message_id == message_id)
            return session.scalars(query).first() is not None

    def add(self, message: SyncedMessage) -> None:
        self._db.write(
            lambda session: session.add(
                SyncedMessageRow(
                    id=message.id,
                    user_id=message.user_id,
                    message_id=message.message_id,
                    application_id=message.application_id,
                    document=_json(message),
                )
            )
        )

    def for_application(self, user_id: str, application_id: str) -> list[SyncedMessage]:
        with self._db.unit_of_work() as session:
            query = active(SyncedMessageRow).where(SyncedMessageRow.user_id == user_id, SyncedMessageRow.application_id == application_id)
            return [SyncedMessage.model_validate(row.document) for row in session.scalars(query)]


class SqlCalendarEventRepository:
    def __init__(self, database: Database) -> None:
        self._db = database

    def get(self, user_id: str, task_id: str) -> CalendarEventRecord | None:
        with self._db.unit_of_work() as session:
            query = active(CalendarEventRow).where(CalendarEventRow.user_id == user_id, CalendarEventRow.task_id == task_id)
            row = session.scalars(query).first()
            return CalendarEventRecord.model_validate(row.document) if row else None

    def save(self, record: CalendarEventRecord) -> None:
        def change(session: Session) -> None:
            row = session.get(CalendarEventRow, record.id)
            if row is None:
                session.add(CalendarEventRow(id=record.id, user_id=record.user_id, task_id=record.task_id, document=_json(record)))
                return
            row.document = _json(record)

        self._db.write(change)
