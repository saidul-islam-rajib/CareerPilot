from sqlalchemy import String, func, select
from sqlalchemy.orm import Mapped, Session, mapped_column

from careerpilot.messaging.models import Conversation, Member, Message, Notification, PushDevice
from careerpilot.platform.clock import Clock
from careerpilot.platform.persistence import ID_LENGTH, SHORT_TEXT, Audited, Base, Database, active

PAIR_LENGTH = ID_LENGTH * 2 + 1
TOKEN_LENGTH = 255


class NotificationRow(Audited, Base):
    __tablename__ = "notifications"

    id: Mapped[str] = mapped_column(String(ID_LENGTH), primary_key=True)
    user_id: Mapped[str] = mapped_column(String(ID_LENGTH), index=True)
    at: Mapped[str] = mapped_column(String(SHORT_TEXT), index=True)
    read_at: Mapped[str | None] = mapped_column(String(SHORT_TEXT), default=None)
    document: Mapped[dict[str, object]]


class ConversationRow(Audited, Base):
    __tablename__ = "conversations"

    id: Mapped[str] = mapped_column(String(ID_LENGTH), primary_key=True)
    kind: Mapped[str] = mapped_column(String(SHORT_TEXT), index=True)
    pair_key: Mapped[str] = mapped_column(String(PAIR_LENGTH), index=True)
    document: Mapped[dict[str, object]]


class ConversationMemberRow(Audited, Base):
    __tablename__ = "conversation_members"

    conversation_id: Mapped[str] = mapped_column(String(ID_LENGTH), primary_key=True)
    member_id: Mapped[str] = mapped_column(String(ID_LENGTH), primary_key=True, index=True)
    document: Mapped[dict[str, object]]


class MessageRow(Audited, Base):
    __tablename__ = "messages"

    id: Mapped[str] = mapped_column(String(ID_LENGTH), primary_key=True)
    conversation_id: Mapped[str] = mapped_column(String(ID_LENGTH), index=True)
    sender_id: Mapped[str] = mapped_column(String(ID_LENGTH))
    at: Mapped[str] = mapped_column(String(SHORT_TEXT), index=True)
    document: Mapped[dict[str, object]]


class PushDeviceRow(Audited, Base):
    __tablename__ = "push_devices"

    token: Mapped[str] = mapped_column(String(TOKEN_LENGTH), primary_key=True)
    user_id: Mapped[str] = mapped_column(String(ID_LENGTH), index=True)
    platform: Mapped[str] = mapped_column(String(SHORT_TEXT))
    document: Mapped[dict[str, object]]


def _json(model: Notification | Conversation | Member | Message | PushDevice) -> dict[str, object]:
    return model.model_dump(mode="json", by_alias=True, exclude_none=True)


class SqlNotificationRepository:
    def __init__(self, database: Database) -> None:
        self._db = database

    def add(self, notification: Notification) -> None:
        self._db.write(
            lambda session: session.add(
                NotificationRow(id=notification.id, user_id=notification.user_id, at=notification.created_at, document=_json(notification))
            )
        )

    def recent(self, user_id: str, limit: int) -> list[Notification]:
        with self._db.unit_of_work() as session:
            rows = session.scalars(
                active(NotificationRow).where(NotificationRow.user_id == user_id).order_by(NotificationRow.at.desc()).limit(limit)
            )
            return [Notification.model_validate(r.document).model_copy(update={"read_at": r.read_at}) for r in rows]

    def unread_count(self, user_id: str) -> int:
        with self._db.unit_of_work() as session:
            query = (
                select(func.count())
                .select_from(NotificationRow)
                .where(NotificationRow.user_id == user_id, NotificationRow.read_at.is_(None), NotificationRow.deleted_at.is_(None))
            )
            return session.scalar(query) or 0

    def mark_read(self, user_id: str, ids: list[str] | None, at: str) -> None:
        def change(session: Session) -> None:
            query = active(NotificationRow).where(NotificationRow.user_id == user_id, NotificationRow.read_at.is_(None))
            if ids is not None:
                query = query.where(NotificationRow.id.in_(ids))
            for row in session.scalars(query):
                row.read_at = at

        self._db.write(change)

    def has_unread(self, user_id: str, target_id: str) -> bool:
        with self._db.unit_of_work() as session:
            rows = session.scalars(active(NotificationRow).where(NotificationRow.user_id == user_id, NotificationRow.read_at.is_(None)))
            return any(Notification.model_validate(r.document).target_id == target_id for r in rows)


class SqlConversationRepository:
    def __init__(self, database: Database) -> None:
        self._db = database

    def get(self, conversation_id: str) -> Conversation | None:
        with self._db.unit_of_work() as session:
            row = session.get(ConversationRow, conversation_id)
            return Conversation.model_validate(row.document) if row and row.deleted_at is None else None

    def by_pair(self, pair_key: str) -> Conversation | None:
        with self._db.unit_of_work() as session:
            row = session.scalars(active(ConversationRow).where(ConversationRow.pair_key == pair_key)).first() if pair_key else None
            return Conversation.model_validate(row.document) if row else None

    def save(self, conversation: Conversation) -> None:
        def change(session: Session) -> None:
            row = session.get(ConversationRow, conversation.id)
            if row is None:
                session.add(
                    ConversationRow(
                        id=conversation.id, kind=conversation.kind.value, pair_key=conversation.pair_key, document=_json(conversation)
                    )
                )
            else:
                row.document = _json(conversation)

        self._db.write(change)

    def members(self, conversation_id: str) -> list[Member]:
        with self._db.unit_of_work() as session:
            rows = session.scalars(active(ConversationMemberRow).where(ConversationMemberRow.conversation_id == conversation_id))
            return [Member.model_validate(r.document) for r in rows]

    def memberships(self, member_id: str) -> list[Member]:
        with self._db.unit_of_work() as session:
            rows = session.scalars(active(ConversationMemberRow).where(ConversationMemberRow.member_id == member_id))
            return [Member.model_validate(r.document) for r in rows]

    def save_member(self, member: Member) -> None:
        def change(session: Session) -> None:
            row = session.get(ConversationMemberRow, (member.conversation_id, member.member_id))
            if row is None:
                session.add(
                    ConversationMemberRow(conversation_id=member.conversation_id, member_id=member.member_id, document=_json(member))
                )
            else:
                row.document = _json(member)

        self._db.write(change)

    def all(self, kind: str | None = None) -> list[Conversation]:
        with self._db.unit_of_work() as session:
            query = active(ConversationRow)
            if kind is not None:
                query = query.where(ConversationRow.kind == kind)
            return [Conversation.model_validate(r.document) for r in session.scalars(query)]


class SqlMessageRepository:
    def __init__(self, database: Database) -> None:
        self._db = database

    def add(self, message: Message) -> None:
        self._db.write(
            lambda session: session.add(
                MessageRow(
                    id=message.id,
                    conversation_id=message.conversation_id,
                    sender_id=message.sender_id,
                    at=message.created_at,
                    document=_json(message),
                )
            )
        )

    def get(self, message_id: str) -> Message | None:
        with self._db.unit_of_work() as session:
            row = session.scalar(active(MessageRow).where(MessageRow.id == message_id))
            return Message.model_validate(row.document) if row else None

    def page(self, conversation_id: str, before: str | None, limit: int) -> list[Message]:
        with self._db.unit_of_work() as session:
            query = active(MessageRow).where(MessageRow.conversation_id == conversation_id)
            if before is not None:
                query = query.where(MessageRow.at < before)
            rows = session.scalars(query.order_by(MessageRow.at.desc(), MessageRow.id.desc()).limit(limit))
            return [Message.model_validate(r.document) for r in rows]

    def count_after(self, conversation_id: str, after: str | None, not_from: str) -> int:
        with self._db.unit_of_work() as session:
            query = (
                select(func.count())
                .select_from(MessageRow)
                .where(MessageRow.conversation_id == conversation_id, MessageRow.sender_id != not_from, MessageRow.deleted_at.is_(None))
            )
            if after is not None:
                query = query.where(MessageRow.at > after)
            return session.scalar(query) or 0

    def count(self, conversation_id: str) -> int:
        with self._db.unit_of_work() as session:
            query = (
                select(func.count())
                .select_from(MessageRow)
                .where(MessageRow.conversation_id == conversation_id, MessageRow.deleted_at.is_(None))
            )
            return session.scalar(query) or 0


class SqlPushDeviceRepository:
    def __init__(self, database: Database, clock: Clock) -> None:
        self._db = database
        self._clock = clock

    def save(self, device: PushDevice) -> None:
        def change(session: Session) -> None:
            row = session.get(PushDeviceRow, device.token)
            if row is None:
                session.add(
                    PushDeviceRow(token=device.token, user_id=device.user_id, platform=device.platform.value, document=_json(device))
                )
                return
            row.restore()
            row.user_id = device.user_id
            row.platform = device.platform.value
            row.document = _json(device)

        self._db.write(change)

    def for_user(self, user_id: str) -> list[PushDevice]:
        with self._db.unit_of_work() as session:
            rows = session.scalars(active(PushDeviceRow).where(PushDeviceRow.user_id == user_id))
            return sorted((PushDevice.model_validate(r.document) for r in rows), key=lambda d: d.registered_at)

    def remove(self, tokens: list[str], reason: str) -> None:
        def change(session: Session) -> None:
            for row in session.scalars(active(PushDeviceRow).where(PushDeviceRow.token.in_(tokens))):
                row.soft_delete(self._clock, reason)

        self._db.write(change)
