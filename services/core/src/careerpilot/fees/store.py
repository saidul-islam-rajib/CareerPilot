from typing import Generic, TypeVar

from careerpilot.fees.enums import RecordKind
from careerpilot.fees.ports import FeeRecordRepository
from careerpilot.platform.clock import IdGenerator
from careerpilot.platform.errors import not_found
from careerpilot.platform.model import CamelModel

REMOVED_BY_USER = "removed_by_user"


Record = TypeVar("Record", bound=CamelModel)


class RecordStore(Generic[Record]):
    def __init__(self, repository: FeeRecordRepository, kind: RecordKind, model: type[Record], ids: IdGenerator, prefix: str) -> None:
        self._repository = repository
        self._kind = kind
        self._model = model
        self._ids = ids
        self._prefix = prefix

    def new_id(self) -> str:
        return self._ids.next(self._prefix)

    def get(self, user_id: str, record_id: str) -> Record | None:
        document = self._repository.get(user_id, self._kind, record_id)
        return self._model.model_validate(document) if document is not None else None

    def find(self, user_id: str, record_id: str) -> Record:
        found = self.get(user_id, record_id)
        if found is None:
            raise not_found(self._kind.value)
        return found

    def all(self, user_id: str) -> list[Record]:
        return [self._model.model_validate(document) for document in self._repository.for_user(user_id, self._kind)]

    def save(self, user_id: str, record_id: str, record: Record) -> Record:
        self._repository.save(user_id, self._kind, record_id, record.to_json())
        return record

    def remove(self, user_id: str, record_id: str) -> None:
        self._repository.remove(user_id, self._kind, record_id, REMOVED_BY_USER)
