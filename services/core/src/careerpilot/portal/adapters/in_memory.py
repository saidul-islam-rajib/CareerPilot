import copy

from careerpilot.portal.enums import RecordKind


class InMemoryPortalRecords:
    def __init__(self) -> None:
        self._items: dict[tuple[str, RecordKind, str], dict[str, object]] = {}

    def get(self, user_id: str, kind: RecordKind, record_id: str) -> dict[str, object] | None:
        found = self._items.get((user_id, kind, record_id))
        return copy.deepcopy(found) if found is not None else None

    def for_user(self, user_id: str, kind: RecordKind) -> list[dict[str, object]]:
        return [copy.deepcopy(doc) for (owner, record_kind, _), doc in self._items.items() if owner == user_id and record_kind is kind]

    def all_of_kind(self, kind: RecordKind) -> list[tuple[str, dict[str, object]]]:
        return [(owner, copy.deepcopy(doc)) for (owner, record_kind, _), doc in self._items.items() if record_kind is kind]

    def save(self, user_id: str, kind: RecordKind, record_id: str, document: dict[str, object]) -> None:
        self._items[(user_id, kind, record_id)] = copy.deepcopy(document)

    def remove(self, user_id: str, kind: RecordKind, record_id: str, reason: str) -> None:
        self._items.pop((user_id, kind, record_id), None)
