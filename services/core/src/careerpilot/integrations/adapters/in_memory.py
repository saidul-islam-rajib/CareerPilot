from careerpilot.integrations.models import CalendarEventRecord, ConnectionRecord, SyncedMessage
from careerpilot.platform.enums import IntegrationProvider


class InMemoryConnectionRepository:
    def __init__(self) -> None:
        self._records: dict[tuple[str, IntegrationProvider], ConnectionRecord] = {}

    def active(self, user_id: str, provider: IntegrationProvider) -> ConnectionRecord | None:
        found = self._records.get((user_id, provider))
        return found.model_copy() if found else None

    def save(self, record: ConnectionRecord) -> None:
        self._records[(record.user_id, record.provider)] = record.model_copy()

    def remove(self, user_id: str, provider: IntegrationProvider, reason: str) -> None:
        self._records.pop((user_id, provider), None)

    def all_active(self, provider: IntegrationProvider) -> list[ConnectionRecord]:
        return [r.model_copy() for (_, p), r in self._records.items() if p is provider]


class InMemorySyncedMessageRepository:
    def __init__(self) -> None:
        self._items: list[SyncedMessage] = []

    def seen(self, user_id: str, message_id: str) -> bool:
        return any(m.user_id == user_id and m.message_id == message_id for m in self._items)

    def add(self, message: SyncedMessage) -> None:
        self._items.append(message.model_copy())

    def for_application(self, user_id: str, application_id: str) -> list[SyncedMessage]:
        return [m.model_copy() for m in self._items if m.user_id == user_id and m.application_id == application_id]


class InMemoryCalendarEventRepository:
    def __init__(self) -> None:
        self._items: dict[tuple[str, str], CalendarEventRecord] = {}

    def get(self, user_id: str, task_id: str) -> CalendarEventRecord | None:
        found = self._items.get((user_id, task_id))
        return found.model_copy() if found else None

    def save(self, record: CalendarEventRecord) -> None:
        self._items[(record.user_id, record.task_id)] = record.model_copy()
