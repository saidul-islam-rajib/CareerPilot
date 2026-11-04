from sqlalchemy import String
from sqlalchemy.orm import Mapped, Session, mapped_column

from careerpilot.platform.clock import Clock
from careerpilot.platform.persistence import ID_LENGTH, SHORT_TEXT, Audited, Base, Database, active
from careerpilot.writing.enums import WritingKind
from careerpilot.writing.models import WritingDraft

REMOVED_BY_USER = "removed_by_user"
USER_ID_KEY = "userId"


class WritingDraftRow(Audited, Base):
    __tablename__ = "writing_drafts"

    id: Mapped[str] = mapped_column(String(ID_LENGTH), primary_key=True)
    user_id: Mapped[str] = mapped_column(String(ID_LENGTH), index=True)
    opportunity_id: Mapped[str] = mapped_column(String(ID_LENGTH), index=True)
    kind: Mapped[str] = mapped_column(String(SHORT_TEXT), index=True)
    drafted_at: Mapped[str] = mapped_column(String(SHORT_TEXT), index=True)
    document: Mapped[dict[str, object]]


def _json(draft: WritingDraft) -> dict[str, object]:
    return draft.model_dump(mode="json", by_alias=True, exclude_none=True)


def _draft(row: WritingDraftRow) -> WritingDraft:
    return WritingDraft.model_validate({**row.document, USER_ID_KEY: row.user_id})


class SqlWritingRepository:
    def __init__(self, database: Database, clock: Clock) -> None:
        self._db = database
        self._clock = clock

    def add(self, draft: WritingDraft) -> None:
        def change(session: Session) -> None:
            session.add(
                WritingDraftRow(
                    id=draft.id,
                    user_id=draft.user_id,
                    opportunity_id=draft.opportunity_id,
                    kind=draft.kind.value,
                    drafted_at=draft.created_at,
                    document=_json(draft),
                )
            )

        self._db.write(change)

    def save(self, draft: WritingDraft) -> None:
        def change(session: Session) -> None:
            row = session.scalar(active(WritingDraftRow).where(WritingDraftRow.id == draft.id))
            if row is not None:
                row.document = _json(draft)

        self._db.write(change)

    def get(self, user_id: str, draft_id: str) -> WritingDraft | None:
        with self._db.unit_of_work() as session:
            row = session.scalar(active(WritingDraftRow).where(WritingDraftRow.id == draft_id, WritingDraftRow.user_id == user_id))
            return _draft(row) if row else None

    def for_user(self, user_id: str, opportunity_id: str | None = None, kind: WritingKind | None = None) -> list[WritingDraft]:
        query = active(WritingDraftRow).where(WritingDraftRow.user_id == user_id)
        if opportunity_id is not None:
            query = query.where(WritingDraftRow.opportunity_id == opportunity_id)
        if kind is not None:
            query = query.where(WritingDraftRow.kind == kind.value)
        with self._db.unit_of_work() as session:
            rows = session.scalars(query.order_by(WritingDraftRow.drafted_at.desc(), WritingDraftRow.id.desc()))
            return [_draft(row) for row in rows]

    def remove(self, user_id: str, draft_id: str) -> None:
        def change(session: Session) -> None:
            for row in session.scalars(active(WritingDraftRow).where(WritingDraftRow.id == draft_id, WritingDraftRow.user_id == user_id)):
                row.soft_delete(self._clock, REMOVED_BY_USER)

        self._db.write(change)
