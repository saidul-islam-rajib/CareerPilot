from careerpilot.messaging.models import Conversation, Member, Message, Notification


class InMemoryNotificationRepository:
    def __init__(self) -> None:
        self._items: list[Notification] = []

    def add(self, notification: Notification) -> None:
        self._items.append(notification.model_copy())

    def recent(self, user_id: str, limit: int) -> list[Notification]:
        mine = [n for n in self._items if n.user_id == user_id]
        return [n.model_copy() for n in sorted(mine, key=lambda n: n.created_at, reverse=True)[:limit]]

    def unread_count(self, user_id: str) -> int:
        return sum(1 for n in self._items if n.user_id == user_id and n.read_at is None)

    def mark_read(self, user_id: str, ids: list[str] | None, at: str) -> None:
        for index, item in enumerate(self._items):
            if item.user_id == user_id and item.read_at is None and (ids is None or item.id in ids):
                self._items[index] = item.model_copy(update={"read_at": at})

    def has_unread(self, user_id: str, target_id: str) -> bool:
        return any(n.user_id == user_id and n.target_id == target_id and n.read_at is None for n in self._items)


class InMemoryConversationRepository:
    def __init__(self) -> None:
        self._conversations: dict[str, Conversation] = {}
        self._members: dict[tuple[str, str], Member] = {}

    def get(self, conversation_id: str) -> Conversation | None:
        found = self._conversations.get(conversation_id)
        return found.model_copy() if found else None

    def by_pair(self, pair_key: str) -> Conversation | None:
        found = next((c for c in self._conversations.values() if pair_key and c.pair_key == pair_key), None)
        return found.model_copy() if found else None

    def save(self, conversation: Conversation) -> None:
        self._conversations[conversation.id] = conversation.model_copy()

    def members(self, conversation_id: str) -> list[Member]:
        return [m.model_copy() for (cid, _), m in self._members.items() if cid == conversation_id]

    def memberships(self, member_id: str) -> list[Member]:
        return [m.model_copy() for (_, mid), m in self._members.items() if mid == member_id]

    def save_member(self, member: Member) -> None:
        self._members[(member.conversation_id, member.member_id)] = member.model_copy()

    def all(self, kind: str | None = None) -> list[Conversation]:
        return [c.model_copy() for c in self._conversations.values() if kind is None or c.kind.value == kind]


class InMemoryMessageRepository:
    def __init__(self) -> None:
        self._messages: list[Message] = []

    def add(self, message: Message) -> None:
        self._messages.append(message.model_copy())

    def page(self, conversation_id: str, before: str | None, limit: int) -> list[Message]:
        mine = [m for m in self._messages if m.conversation_id == conversation_id and (before is None or m.created_at < before)]
        return [m.model_copy() for m in sorted(mine, key=lambda m: (m.created_at, m.id), reverse=True)[:limit]]

    def count_after(self, conversation_id: str, after: str | None, not_from: str) -> int:
        return sum(
            1
            for m in self._messages
            if m.conversation_id == conversation_id and m.sender_id != not_from and (after is None or m.created_at > after)
        )

    def count(self, conversation_id: str) -> int:
        return sum(1 for m in self._messages if m.conversation_id == conversation_id)
