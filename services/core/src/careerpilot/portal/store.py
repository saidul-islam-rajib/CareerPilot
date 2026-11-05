from typing import Generic, TypeVar

from careerpilot.platform.model import CamelModel
from careerpilot.portal.enums import RecordKind
from careerpilot.portal.ports import PortalRecordRepository

REMOVED_BY_USER = "removed_by_user"
SYSTEM_OWNER = "portal"

Record = TypeVar("Record", bound=CamelModel)


class RecordStore(Generic[Record]):
    def __init__(self, repository: PortalRecordRepository, kind: RecordKind, model: type[Record]) -> None:
        self._repository = repository
        self._kind = kind
        self._model = model

    def get(self, user_id: str, record_id: str) -> Record | None:
        document = self._repository.get(user_id, self._kind, record_id)
        return self._model.model_validate(document) if document is not None else None

    def all(self, user_id: str) -> list[Record]:
        return [self._model.model_validate(document) for document in self._repository.for_user(user_id, self._kind)]

    def everyone(self) -> list[tuple[str, Record]]:
        return [(owner, self._model.model_validate(document)) for owner, document in self._repository.all_of_kind(self._kind)]

    def save(self, user_id: str, record_id: str, record: Record) -> Record:
        self._repository.save(user_id, self._kind, record_id, record.to_json())
        return record

    def remove(self, user_id: str, record_id: str, reason: str = REMOVED_BY_USER) -> None:
        self._repository.remove(user_id, self._kind, record_id, reason)
