import re
from collections.abc import Callable, Mapping
from dataclasses import dataclass

from careerpilot.candidate.context import CandidateContext
from careerpilot.candidate.models import StoredFile
from careerpilot.candidate.ports import CandidateWorkspace
from careerpilot.candidate.services.profile import Upload, display_file_name
from careerpilot.messaging.models import (
    Attachment,
    AttachmentView,
    Connection,
    Conversation,
    ConversationSummary,
    Member,
    MemberCard,
    Message,
    MessagePage,
    MessageView,
    ReplyPreview,
)
from careerpilot.messaging.notifications import NotificationService
from careerpilot.messaging.ports import ConversationRepository, MessageRepository
from careerpilot.platform.clock import iso
from careerpilot.platform.enums import (
    ContactKind,
    ConversationKind,
    MemberType,
    MessageKind,
    MessageState,
    NotificationKind,
    NotificationTarget,
    UserAccountStatus,
)
from careerpilot.platform.errors import DomainError, ErrorCode, not_found, validation_error
from careerpilot.platform.files import EXTENSIONS, FileStorage, detect_content_type
from careerpilot.platform.messages import translate

LinkFactory = Callable[[str, str], str]
CONVERSATION_ID_PREFIX = "cnv"
MESSAGE_ID_PREFIX = "msg"
FILE_ID_PREFIX = "f"
CHAT_FOLDER = "chat"
TEAM_MEMBER = "team"
PAIR_SEPARATOR = ":"
EMAIL_MARK = "@"
NON_DIGITS = re.compile(r"\D")
PHONE_SHAPE = re.compile(r"^\+?[\d\s().-]{7,}$")
PHONE_MATCH_DIGITS = 10


@dataclass(frozen=True)
class MessagingContext:
    candidate: CandidateContext
    conversations: ConversationRepository
    messages: MessageRepository
    notifications: NotificationService
    storage: FileStorage


@dataclass(frozen=True)
class Sender:
    id: str
    type: MemberType
    name: str


@dataclass(frozen=True)
class NewAttachment:
    kind: MessageKind
    upload: Upload
    duration_seconds: int | None = None


@dataclass(frozen=True)
class Draft:
    text: str
    attachment: NewAttachment | None = None
    reply_to_id: str | None = None


def pair_key(first: str, second: str) -> str:
    return PAIR_SEPARATOR.join(sorted([first, second]))


def phone_digits(value: str) -> str:
    return NON_DIGITS.sub("", value)[-PHONE_MATCH_DIGITS:]


class MessagingService:
    def __init__(self, context: MessagingContext) -> None:
        self._ctx = context
        self._candidate = context.candidate
        self._config = context.candidate.settings.messaging

    def directory(self, user_id: str, query: str, link: LinkFactory) -> list[MemberCard]:
        typed = query.strip()
        if len(typed) < self._config.directory_min_query:
            return []
        me = self._candidate.workspaces.get(user_id)
        found: list[MemberCard] = []
        for other_id in self._candidate.accounts.all_ids():
            if other_id == user_id or other_id in me.preferences.blocked_users:
                continue
            account = self._candidate.accounts.get(other_id)
            if account is None or account.status is not UserAccountStatus.ACTIVE:
                continue
            workspace = self._candidate.workspaces.get(other_id)
            if not workspace.preferences.discoverable or user_id in workspace.preferences.blocked_users:
                continue
            if self._matches(typed, account.user.full_name, account.user.email, workspace):
                found.append(self._card(other_id, workspace, link))
            if len(found) >= self._config.directory_limit:
                break
        return found

    def card(self, user_id: str, link: LinkFactory) -> MemberCard:
        return self._card(user_id, self._candidate.workspaces.get(user_id), link)

    def start(self, user_id: str, other_id: str, link: LinkFactory) -> ConversationSummary:
        if other_id == user_id or self._candidate.accounts.get(other_id) is None:
            raise not_found("member")
        self._require_unblocked(user_id, other_id)
        key = pair_key(user_id, other_id)
        conversation = self._ctx.conversations.by_pair(key)
        if conversation is None:
            conversation = self._create(ConversationKind.DIRECT, key, [(user_id, MemberType.USER), (other_id, MemberType.USER)])
        return self._summary(user_id, conversation, link)

    def team(self, user_id: str) -> Conversation:
        key = pair_key(user_id, TEAM_MEMBER)
        existing = self._ctx.conversations.by_pair(key)
        return existing or self._create(ConversationKind.TEAM, key, [(user_id, MemberType.USER), (TEAM_MEMBER, MemberType.TEAM)])

    def conversations(self, user_id: str, link: LinkFactory) -> list[ConversationSummary]:
        summaries: list[ConversationSummary] = []
        for member in self._ctx.conversations.memberships(user_id):
            conversation = self._ctx.conversations.get(member.conversation_id)
            if conversation is not None and (conversation.last_message_at or conversation.kind is ConversationKind.TEAM):
                summaries.append(self._summary(user_id, conversation, link))
        return sorted(summaries, key=lambda s: s.last_message_at or "", reverse=True)

    def messages(self, user_id: str, conversation_id: str, before: str | None, link: LinkFactory) -> MessagePage:
        conversation = self._own(user_id, conversation_id)
        return self._page(user_id, conversation, before, link)

    def send(self, sender: Sender, conversation_id: str, text: str, attachment: NewAttachment | None, link: LinkFactory) -> MessageView:
        return self.post(sender, conversation_id, Draft(text=text, attachment=attachment), link)

    def post(self, sender: Sender, conversation_id: str, draft: Draft, link: LinkFactory) -> MessageView:
        attachment = draft.attachment
        conversation = self._ctx.conversations.get(conversation_id)
        members = self._ctx.conversations.members(conversation_id)
        if conversation is None or not any(m.member_id == self._member_id(sender) for m in members):
            raise not_found("conversation")
        others = [m for m in members if m.member_id != self._member_id(sender)]
        if conversation.kind is ConversationKind.DIRECT:
            self._require_unblocked(sender.id, others[0].member_id)
        message = Message(
            id=self._candidate.ids.next(MESSAGE_ID_PREFIX),
            conversation_id=conversation_id,
            sender_id=self._member_id(sender),
            sender_type=sender.type,
            sender_name=sender.name,
            author_id=sender.id,
            kind=attachment.kind if attachment else MessageKind.TEXT,
            text=self._text(draft.text, required=attachment is None),
            attachment=self._attach(conversation_id, attachment) if attachment else None,
            reply_to_id=self._reply_target(conversation_id, draft.reply_to_id),
            created_at=iso(self._candidate.clock.now()),
        )
        self._ctx.messages.add(message)
        preview = self.preview(message)
        self._ctx.conversations.save(
            conversation.model_copy(
                update={
                    "last_message_at": message.created_at,
                    "last_message_preview": preview,
                    "last_message_kind": message.kind,
                    "last_sender_id": message.sender_id,
                }
            )
        )
        self._mark(conversation_id, self._member_id(sender), read=True)
        self._notify(sender, conversation, others, preview)
        return self._view(message, self._member_id(sender), members, link)

    def read(self, member_id: str, conversation_id: str) -> None:
        self._mark(conversation_id, member_id, read=True)
        if member_id != TEAM_MEMBER:
            self._ctx.notifications.read_target(member_id, conversation_id)

    def mute(self, user_id: str, conversation_id: str, muted: bool) -> None:
        member = next((m for m in self._ctx.conversations.members(conversation_id) if m.member_id == user_id), None)
        if member is None:
            raise not_found("conversation")
        self._ctx.conversations.save_member(member.model_copy(update={"muted": muted}))

    def block(self, user_id: str, other_id: str, blocked: bool) -> None:
        workspace = self._candidate.workspaces.get(user_id)
        current = [b for b in workspace.preferences.blocked_users if b != other_id]
        workspace.preferences.blocked_users = [*current, other_id] if blocked else current
        self._candidate.workspaces.save(user_id, workspace)

    def set_discoverable(self, user_id: str, discoverable: bool) -> None:
        workspace = self._candidate.workspaces.get(user_id)
        workspace.preferences.discoverable = discoverable
        self._candidate.workspaces.save(user_id, workspace)

    def team_page(self, user_id: str, before: str | None, link: LinkFactory) -> MessagePage:
        return self._page(TEAM_MEMBER, self.team(user_id), before, link)

    def admin_page(self, conversation_id: str, before: str | None, link: LinkFactory) -> MessagePage:
        conversation = self._ctx.conversations.get(conversation_id)
        if conversation is None:
            raise not_found("conversation")
        return self._page(TEAM_MEMBER, conversation, before, link)

    def connections(self, user_id: str, link: LinkFactory) -> list[Connection]:
        found: list[Connection] = []
        for member in self._ctx.conversations.memberships(user_id):
            conversation = self._ctx.conversations.get(member.conversation_id)
            if conversation is None or conversation.kind is not ConversationKind.DIRECT:
                continue
            other = next((m for m in self._ctx.conversations.members(conversation.id) if m.member_id != user_id), None)
            if other is None:
                continue
            found.append(
                Connection(
                    member=self._card(other.member_id, self._candidate.workspaces.get(other.member_id), link),
                    conversation_id=conversation.id,
                    connected_at=conversation.created_at,
                    messages=self._ctx.messages.count(conversation.id),
                    last_message_at=conversation.last_message_at,
                )
            )
        return sorted(found, key=lambda c: c.last_message_at or c.connected_at, reverse=True)

    def preview(self, message: Message) -> str:
        if message.kind is MessageKind.TEXT:
            return message.text[: self._config.preview_length]
        name = message.attachment.file.file_name if message.attachment else ""
        return translate(f"messaging.previews.{message.kind.value}", {"name": name})

    def _matches(self, typed: str, name: str, email: str, workspace: CandidateWorkspace) -> bool:
        contacts = workspace.profile.active_contacts()
        if EMAIL_MARK in typed:
            emails = {email.casefold(), *(c.value.casefold() for c in contacts if c.kind is ContactKind.EMAIL)}
            return typed.casefold() in emails
        if PHONE_SHAPE.match(typed):
            wanted = phone_digits(typed)
            return any(phone_digits(c.value) == wanted for c in contacts if c.kind is ContactKind.PHONE)
        return typed.casefold() in name.casefold()

    def _card(self, user_id: str, workspace: CandidateWorkspace, link: LinkFactory) -> MemberCard:
        account = self._candidate.accounts.get(user_id)
        photo = workspace.profile.photo
        return MemberCard(
            id=user_id,
            name=account.user.full_name if account else workspace.profile.full_name,
            headline=workspace.profile.headline,
            photo_url=link(photo.key, photo.file_name) if photo else workspace.profile.photo_url,
        )

    def _create(self, kind: ConversationKind, key: str, members: list[tuple[str, MemberType]]) -> Conversation:
        now = iso(self._candidate.clock.now())
        conversation = Conversation(id=self._candidate.ids.next(CONVERSATION_ID_PREFIX), kind=kind, pair_key=key, created_at=now)
        self._ctx.conversations.save(conversation)
        for member_id, member_type in members:
            self._ctx.conversations.save_member(
                Member(conversation_id=conversation.id, member_id=member_id, member_type=member_type, joined_at=now)
            )
        return conversation

    def _own(self, user_id: str, conversation_id: str) -> Conversation:
        conversation = self._ctx.conversations.get(conversation_id)
        members = self._ctx.conversations.members(conversation_id)
        if conversation is None or not any(m.member_id == user_id for m in members):
            raise not_found("conversation")
        return conversation

    def _page(self, viewer: str, conversation: Conversation, before: str | None, link: LinkFactory) -> MessagePage:
        members = self._ctx.conversations.members(conversation.id)
        found = self._ctx.messages.page(conversation.id, before, self._config.page_size + 1)
        shown = list(reversed(found[: self._config.page_size]))
        return MessagePage(
            conversation=self._summary(viewer, conversation, link),
            messages=[self._view(m, viewer, members, link, {m.id: m for m in found}) for m in shown],
            has_more=len(found) > self._config.page_size,
        )

    def _summary(self, viewer: str, conversation: Conversation, link: LinkFactory) -> ConversationSummary:
        members = self._ctx.conversations.members(conversation.id)
        mine = next((m for m in members if m.member_id == viewer), None)
        other = next((m for m in members if m.member_id != viewer), None)
        title, photo, other_id = self._counterpart(conversation, other, link)
        last_from_me = bool(conversation.last_message_at) and conversation.last_sender_id == viewer
        blocked = viewer != TEAM_MEMBER and other_id is not None and other_id in self._blocked_by(viewer)
        return ConversationSummary(
            id=conversation.id,
            kind=conversation.kind,
            title=title,
            photo_url=photo,
            other_member_id=other_id,
            last_message_at=conversation.last_message_at,
            last_message_preview=conversation.last_message_preview,
            last_message_kind=conversation.last_message_kind,
            last_from_me=last_from_me,
            last_state=self._state(conversation.last_message_at, members, mine) if conversation.last_message_at and last_from_me else None,
            unread_count=self._ctx.messages.count_after(conversation.id, mine.last_read_at if mine else None, viewer),
            muted=mine.muted if mine else False,
            blocked=blocked,
        )

    def _counterpart(self, conversation: Conversation, other: Member | None, link: LinkFactory) -> tuple[str, str | None, str | None]:
        if other is None:
            return "", None, None
        if other.member_type is MemberType.TEAM:
            return self._team_name(), None, None
        card = self._card(other.member_id, self._candidate.workspaces.get(other.member_id), link)
        return card.name, card.photo_url, card.id

    def _view(
        self, message: Message, viewer: str, members: list[Member], link: LinkFactory, known: Mapping[str, Message] | None = None
    ) -> MessageView:
        from_me = message.sender_id == viewer
        viewer_member = next((m for m in members if m.member_id == viewer), None)
        attachment = message.attachment
        return MessageView(
            id=message.id,
            conversation_id=message.conversation_id,
            kind=message.kind,
            text=message.text,
            attachment=self._attachment_view(attachment, link) if attachment else None,
            reply_to=self._reply_preview(message.reply_to_id, viewer, known or {}),
            from_me=from_me,
            sender_name=message.sender_name,
            created_at=message.created_at,
            state=self._state(message.created_at, members, viewer_member) if from_me else None,
        )

    def _reply_target(self, conversation_id: str, reply_to_id: str | None) -> str | None:
        if reply_to_id is None:
            return None
        original = self._ctx.messages.get(reply_to_id)
        if original is None or original.conversation_id != conversation_id:
            raise validation_error("reply_to")
        return original.id

    def _reply_preview(self, reply_to_id: str | None, viewer: str, known: Mapping[str, Message]) -> ReplyPreview | None:
        if reply_to_id is None:
            return None
        original = known.get(reply_to_id) or self._ctx.messages.get(reply_to_id)
        if original is None:
            return None
        return ReplyPreview(
            id=original.id,
            kind=original.kind,
            sender_name=original.sender_name,
            from_me=original.sender_id == viewer,
            text=self.preview(original),
        )

    @staticmethod
    def _attachment_view(attachment: Attachment, link: LinkFactory) -> AttachmentView:
        file = attachment.file
        return AttachmentView(
            url=link(file.key, file.file_name),
            file_name=file.file_name,
            content_type=file.content_type,
            size_bytes=file.size_bytes,
            duration_seconds=attachment.duration_seconds,
        )

    @staticmethod
    def _state(at: str | None, members: list[Member], viewer: Member | None) -> MessageState:
        others = [m for m in members if viewer is None or m.member_id != viewer.member_id]
        if at and others and all(m.last_read_at and m.last_read_at >= at for m in others):
            return MessageState.READ
        if at and others and all(m.last_delivered_at and m.last_delivered_at >= at for m in others):
            return MessageState.DELIVERED
        return MessageState.SENT

    def _text(self, text: str, required: bool) -> str:
        cleaned = text.strip()
        if required and not cleaned:
            raise validation_error("message_text")
        if len(cleaned) > self._config.max_text_length:
            raise validation_error("message_text")
        return cleaned

    def _attach(self, conversation_id: str, attachment: NewAttachment) -> Attachment:
        rule = self._config.attachments.get(attachment.kind.value)
        data = attachment.upload.data
        if rule is None or not data:
            raise validation_error("file_empty")
        if len(data) > rule.max_bytes:
            raise validation_error("file_too_large")
        content_type = detect_content_type(data)
        if content_type is None or content_type not in rule.types:
            raise validation_error("file_type")
        duration = attachment.duration_seconds
        if duration is not None and rule.max_seconds and (duration < 0 or duration > rule.max_seconds):
            raise validation_error("voice_too_long")
        key = f"{CHAT_FOLDER}/{conversation_id}/{self._candidate.ids.next(FILE_ID_PREFIX).lower()}.{EXTENSIONS[content_type]}"
        self._ctx.storage.put(key, data)
        limits = self._candidate.settings.profile.limits
        stored = StoredFile(
            key=key,
            file_name=display_file_name(attachment.upload.file_name, limits.document_name_max_length),
            content_type=content_type,
            size_bytes=len(data),
            uploaded_at=iso(self._candidate.clock.now()),
        )
        return Attachment(file=stored, duration_seconds=duration)

    def _mark(self, conversation_id: str, member_id: str, read: bool) -> None:
        member = next((m for m in self._ctx.conversations.members(conversation_id) if m.member_id == member_id), None)
        if member is None:
            return
        now = iso(self._candidate.clock.now())
        update = {"last_delivered_at": now, "last_read_at": now} if read else {"last_delivered_at": now}
        self._ctx.conversations.save_member(member.model_copy(update=update))

    def _notify(self, sender: Sender, conversation: Conversation, others: list[Member], preview: str) -> None:
        kind = NotificationKind.TEAM_MESSAGE if sender.type is MemberType.TEAM else NotificationKind.MESSAGE
        title = self._team_name() if sender.type is MemberType.TEAM else sender.name
        for member in others:
            if member.member_type is MemberType.USER and not member.muted:
                self._ctx.notifications.notify_once(
                    member.member_id, kind, title, preview, (NotificationTarget.CONVERSATION, conversation.id)
                )

    def _require_unblocked(self, user_id: str, other_id: str) -> None:
        mine = self._candidate.workspaces.get(user_id).preferences.blocked_users
        theirs = self._candidate.workspaces.get(other_id).preferences.blocked_users
        if other_id in mine or user_id in theirs:
            raise DomainError(ErrorCode.FORBIDDEN, "member_blocked")

    def _team_name(self) -> str:
        return translate("messaging.teamName", {"product": self._candidate.settings.branding.product_name})

    @staticmethod
    def _member_id(sender: Sender) -> str:
        return TEAM_MEMBER if sender.type is MemberType.TEAM else sender.id

    def _blocked_by(self, user_id: str) -> list[str]:
        return self._candidate.workspaces.get(user_id).preferences.blocked_users
