from pydantic import Field

from careerpilot.candidate.models import StoredFile
from careerpilot.platform.enums import (
    ConversationKind,
    MemberType,
    MessageKind,
    MessageState,
    NotificationKind,
    NotificationTarget,
)
from careerpilot.platform.model import CamelModel


class Notification(CamelModel):
    id: str
    user_id: str
    kind: NotificationKind
    title: str
    body: str
    target: NotificationTarget
    target_id: str
    created_at: str
    read_at: str | None = None


class Attachment(CamelModel):
    file: StoredFile
    duration_seconds: int | None = None


class Message(CamelModel):
    id: str
    conversation_id: str
    sender_id: str
    sender_type: MemberType
    sender_name: str = ""
    author_id: str = ""
    kind: MessageKind
    text: str = ""
    attachment: Attachment | None = None
    created_at: str


class Member(CamelModel):
    conversation_id: str
    member_id: str
    member_type: MemberType
    joined_at: str
    last_read_at: str | None = None
    last_delivered_at: str | None = None
    muted: bool = False


class Conversation(CamelModel):
    id: str
    kind: ConversationKind
    pair_key: str = ""
    created_at: str
    last_message_at: str | None = None
    last_message_preview: str = ""
    last_message_kind: MessageKind | None = None
    last_sender_id: str = ""


class AttachmentView(CamelModel):
    url: str
    file_name: str
    content_type: str
    size_bytes: int
    duration_seconds: int | None = None


class MessageView(CamelModel):
    id: str
    conversation_id: str
    kind: MessageKind
    text: str
    attachment: AttachmentView | None = None
    from_me: bool
    sender_name: str
    created_at: str
    state: MessageState | None = None


class MemberCard(CamelModel):
    id: str
    name: str
    headline: str = ""
    photo_url: str | None = None


class ConversationSummary(CamelModel):
    id: str
    kind: ConversationKind
    title: str
    photo_url: str | None = None
    other_member_id: str | None = None
    last_message_at: str | None = None
    last_message_preview: str = ""
    last_message_kind: MessageKind | None = None
    last_from_me: bool = False
    last_state: MessageState | None = None
    unread_count: int = 0
    muted: bool = False
    blocked: bool = False


class MessagePage(CamelModel):
    conversation: ConversationSummary
    messages: list[MessageView]
    has_more: bool


class NotificationView(CamelModel):
    id: str
    kind: NotificationKind
    title: str
    body: str
    target: NotificationTarget
    target_id: str
    created_at: str
    read: bool


class Inbox(CamelModel):
    unread_messages: int
    unread_notifications: int
    latest: list[NotificationView] = Field(default_factory=list[NotificationView])


class Connection(CamelModel):
    member: MemberCard
    conversation_id: str
    connected_at: str
    messages: int
    last_message_at: str | None = None
