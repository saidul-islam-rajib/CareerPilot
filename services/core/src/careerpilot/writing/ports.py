from typing import Protocol

from careerpilot.writing.enums import WritingKind
from careerpilot.writing.models import Generated, WritingDraft, WritingRequest


class GenerationUnavailableError(Exception):
    pass


class GenerationRefusedError(Exception):
    pass


class DraftGenerator(Protocol):
    @property
    def model(self) -> str | None: ...

    def supports(self, kind: WritingKind) -> bool: ...

    def generate(self, request: WritingRequest) -> Generated: ...


class WritingRepository(Protocol):
    def add(self, draft: WritingDraft) -> None: ...

    def save(self, draft: WritingDraft) -> None: ...

    def get(self, user_id: str, draft_id: str) -> WritingDraft | None: ...

    def for_user(self, user_id: str, opportunity_id: str | None = None, kind: WritingKind | None = None) -> list[WritingDraft]: ...

    def remove(self, user_id: str, draft_id: str) -> None: ...
