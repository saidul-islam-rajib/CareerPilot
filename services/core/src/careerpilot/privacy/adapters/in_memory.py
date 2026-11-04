from careerpilot.privacy.enums import DeletionStatus, ExportStatus
from careerpilot.privacy.models import ConsentRecord, DeletionRecord, ExportRequest


class InMemoryExportRepository:
    def __init__(self) -> None:
        self._items: dict[str, ExportRequest] = {}

    def save(self, request: ExportRequest) -> None:
        self._items[request.id] = request.model_copy()

    def get(self, request_id: str) -> ExportRequest | None:
        found = self._items.get(request_id)
        return found.model_copy() if found else None

    def for_user(self, user_id: str) -> list[ExportRequest]:
        mine = [r for r in self._items.values() if r.user_id == user_id]
        return [r.model_copy() for r in sorted(mine, key=lambda r: r.requested_at, reverse=True)]

    def with_status(self, status: ExportStatus) -> list[ExportRequest]:
        return [r.model_copy() for r in self._items.values() if r.status is status]

    def recent(self, limit: int) -> list[ExportRequest]:
        return [r.model_copy() for r in sorted(self._items.values(), key=lambda r: r.requested_at, reverse=True)[:limit]]


class InMemoryDeletionRepository:
    def __init__(self) -> None:
        self._items: dict[str, DeletionRecord] = {}

    def save(self, record: DeletionRecord) -> None:
        self._items[record.id] = record.model_copy()

    def latest(self, user_id: str) -> DeletionRecord | None:
        mine = [r for r in self._items.values() if r.user_id == user_id]
        return max(mine, key=lambda r: r.requested_at).model_copy() if mine else None

    def with_status(self, status: DeletionStatus) -> list[DeletionRecord]:
        return [r.model_copy() for r in self._items.values() if r.status is status]

    def recent(self, limit: int) -> list[DeletionRecord]:
        return [r.model_copy() for r in sorted(self._items.values(), key=lambda r: r.requested_at, reverse=True)[:limit]]


class InMemoryConsentRepository:
    def __init__(self) -> None:
        self._items: list[ConsentRecord] = []

    def add(self, record: ConsentRecord) -> None:
        self._items.append(record.model_copy())

    def for_user(self, user_id: str) -> list[ConsentRecord]:
        return [r.model_copy() for r in sorted((r for r in self._items if r.user_id == user_id), key=lambda r: (r.at, r.id))]
