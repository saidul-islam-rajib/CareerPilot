import re
from dataclasses import dataclass

from careerpilot.candidate.models import ApplicationRecord
from careerpilot.messaging.models import Inbox, Member, Notification, NotificationView, PushDevice
from careerpilot.messaging.ports import ConversationRepository, MessageRepository, NotificationRepository, PushDeviceRepository
from careerpilot.platform.clock import Clock, IdGenerator, iso
from careerpilot.platform.config import MessagingConfig
from careerpilot.platform.enums import DevicePlatform, NotificationKind, NotificationTarget, SubmissionStatus
from careerpilot.platform.errors import validation_error
from careerpilot.platform.messages import translate
from careerpilot.platform.push import PushDispatcher, PushMessage

NOTIFICATION_ID_PREFIX = "ntf"
LATEST_LIMIT = 5
PUSH_TOKEN_DETAIL = "push_token"
UNREGISTERED_REASON = "push address no longer valid"
SIGNED_OUT_REASON = "signed out on this device"
DEVICE_LIMIT_REASON = "replaced by a newer device"
APPLICATION_KINDS = {
    SubmissionStatus.SUBMITTED_AWAITING_CONFIRMATION: NotificationKind.APPLICATION_SUBMITTED,
    SubmissionStatus.CONFIRMED: NotificationKind.APPLICATION_CONFIRMED,
}


@dataclass(frozen=True)
class NotificationContext:
    notifications: NotificationRepository
    conversations: ConversationRepository
    messages: MessageRepository
    clock: Clock
    ids: IdGenerator
    config: MessagingConfig
    devices: PushDeviceRepository
    push: PushDispatcher


def notification_view(notification: Notification) -> NotificationView:
    return NotificationView(
        id=notification.id,
        kind=notification.kind,
        title=notification.title,
        body=notification.body,
        target=notification.target,
        target_id=notification.target_id,
        created_at=notification.created_at,
        read=notification.read_at is not None,
    )


class NotificationService:
    def __init__(self, context: NotificationContext) -> None:
        self._ctx = context
        self._token = re.compile(context.config.push.token_pattern)

    def notify(self, user_id: str, kind: NotificationKind, title: str, body: str, target: tuple[NotificationTarget, str]) -> None:
        self._store(user_id, kind, title, body, target)
        self._push(user_id, kind, title, body, target)

    def notify_once(self, user_id: str, kind: NotificationKind, title: str, body: str, target: tuple[NotificationTarget, str]) -> None:
        if not self._ctx.notifications.has_unread(user_id, target[1]):
            self._store(user_id, kind, title, body, target)
        self._push(user_id, kind, title, body, target)

    def register_device(self, user_id: str, token: str, platform: DevicePlatform) -> None:
        if not self._token.match(token):
            raise validation_error(PUSH_TOKEN_DETAIL)
        now = iso(self._ctx.clock.now())
        self._ctx.devices.save(PushDevice(token=token, user_id=user_id, platform=platform, registered_at=now))
        mine = self._ctx.devices.for_user(user_id)
        extra = len(mine) - self._ctx.config.push.max_devices_per_user
        if extra > 0:
            self._ctx.devices.remove([d.token for d in mine[:extra]], DEVICE_LIMIT_REASON)

    def unregister_device(self, user_id: str, token: str) -> None:
        if any(d.token == token for d in self._ctx.devices.for_user(user_id)):
            self._ctx.devices.remove([token], SIGNED_OUT_REASON)

    def _push(self, user_id: str, kind: NotificationKind, title: str, body: str, target: tuple[NotificationTarget, str]) -> None:
        tokens = [d.token for d in self._ctx.devices.for_user(user_id)]
        if not tokens:
            return
        data = {"kind": kind.value, "target": target[0].value, "targetId": target[1]}
        self._ctx.push.dispatch(
            PushMessage(to=tokens, title=title, body=body, data=data),
            lambda gone: self._ctx.devices.remove(gone, UNREGISTERED_REASON),
        )

    def _store(self, user_id: str, kind: NotificationKind, title: str, body: str, target: tuple[NotificationTarget, str]) -> None:
        self._ctx.notifications.add(
            Notification(
                id=self._ctx.ids.next(NOTIFICATION_ID_PREFIX),
                user_id=user_id,
                kind=kind,
                title=title,
                body=body,
                target=target[0],
                target_id=target[1],
                created_at=iso(self._ctx.clock.now()),
            )
        )

    def application_changed(self, user_id: str, application: ApplicationRecord) -> None:
        kind = APPLICATION_KINDS.get(application.submission_status)
        if kind is None:
            return
        names = {"title": application.opportunity.title, "organization": application.opportunity.organization}
        self.notify(
            user_id,
            kind,
            translate(f"notifications.{kind.value}.title"),
            translate(f"notifications.{kind.value}.body", names),
            (NotificationTarget.APPLICATION, application.id),
        )

    def recent(self, user_id: str) -> list[NotificationView]:
        return [notification_view(n) for n in self._ctx.notifications.recent(user_id, self._ctx.config.notifications_page_size)]

    def read(self, user_id: str, ids: list[str] | None) -> None:
        self._ctx.notifications.mark_read(user_id, ids, iso(self._ctx.clock.now()))

    def read_target(self, user_id: str, target_id: str) -> None:
        unread = [
            n.id for n in self._ctx.notifications.recent(user_id, self._ctx.config.notifications_page_size) if n.target_id == target_id
        ]
        if unread:
            self.read(user_id, unread)

    def inbox(self, user_id: str) -> Inbox:
        unread_messages = 0
        now = iso(self._ctx.clock.now())
        for member in self._ctx.conversations.memberships(user_id):
            conversation = self._ctx.conversations.get(member.conversation_id)
            if conversation is None or conversation.last_message_at is None:
                continue
            if not member.muted:
                unread_messages += self._ctx.messages.count_after(member.conversation_id, member.last_read_at, user_id)
            if member.last_delivered_at is None or member.last_delivered_at < conversation.last_message_at:
                self._delivered(member, now)
        latest = [n for n in self.recent(user_id)[:LATEST_LIMIT] if not n.read]
        return Inbox(
            unread_messages=unread_messages,
            unread_notifications=self._ctx.notifications.unread_count(user_id),
            latest=latest,
        )

    def _delivered(self, member: Member, now: str) -> None:
        self._ctx.conversations.save_member(member.model_copy(update={"last_delivered_at": now}))
