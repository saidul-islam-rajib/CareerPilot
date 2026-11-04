from careerpilot.writing.enums import WritingKind
from careerpilot.writing.models import WritingDraft


class InMemoryWritingRepository:
    def __init__(self) -> None:
        self._items: dict[str, WritingDraft] = {}

    def add(self, draft: WritingDraft) -> None:
        self._items[draft.id] = draft.model_copy(deep=True)

    def save(self, draft: WritingDraft) -> None:
        self._items[draft.id] = draft.model_copy(deep=True)

    def get(self, user_id: str, draft_id: str) -> WritingDraft | None:
        found = self._items.get(draft_id)
        return found.model_copy(deep=True) if found and found.user_id == user_id else None

    def for_user(self, user_id: str, opportunity_id: str | None = None, kind: WritingKind | None = None) -> list[WritingDraft]:
        mine = [
            d
            for d in self._items.values()
            if d.user_id == user_id and (opportunity_id is None or d.opportunity_id == opportunity_id) and (kind is None or d.kind is kind)
        ]
        return [d.model_copy(deep=True) for d in sorted(mine, key=lambda d: (d.created_at, d.id), reverse=True)]

    def remove(self, user_id: str, draft_id: str) -> None:
        found = self._items.get(draft_id)
        if found and found.user_id == user_id:
            del self._items[draft_id]
