from collections.abc import Callable
from dataclasses import dataclass

from careerpilot.candidate.answer_rules import active_saved, detect_topic, fill_blank_answers, group_key, question_key, saved_key
from careerpilot.candidate.context import CandidateContext
from careerpilot.candidate.models import QuestionAnswer, QuestionBank, QuestionGroup, SavedAnswer
from careerpilot.candidate.ports import CandidateWorkspace
from careerpilot.candidate.profile_rules import clean_multiline, clean_text, require_length
from careerpilot.platform.clock import iso
from careerpilot.platform.enums import AnswerTopic, ApprovalState
from careerpilot.platform.errors import not_found, validation_error


@dataclass(frozen=True)
class AnswerDraft:
    topic: AnswerTopic
    question: str
    answer: str


@dataclass
class _Group:
    topic: AnswerTopic
    question: str
    count: int = 0
    last_answer: str = ""
    last_item: QuestionAnswer | None = None
    needs_answer: bool = False


def upsert_saved_answer(workspace: CandidateWorkspace, draft: AnswerDraft, new_id: Callable[[], str], now: str) -> SavedAnswer:
    key = group_key(draft.topic, draft.question)
    existing = next((a for a in active_saved(workspace) if saved_key(a) == key), None)
    if existing is not None:
        updated = existing.model_copy(update={"question": draft.question, "answer": draft.answer, "updated_at": now})
        workspace.saved_answers = [updated if a.id == existing.id else a for a in workspace.saved_answers]
        return updated
    created = SavedAnswer(id=new_id(), topic=draft.topic, question=draft.question, answer=draft.answer, created_at=now, updated_at=now)
    workspace.saved_answers.append(created)
    return created


class AnswerService:
    def __init__(self, context: CandidateContext) -> None:
        self._ctx = context
        self._config = context.settings.answers

    def bank(self, user_id: str) -> QuestionBank:
        return self._bank(self._ctx.workspaces.get(user_id))

    def save(self, user_id: str, draft: AnswerDraft, answer_id: str | None = None) -> QuestionBank:
        checked = self.checked(draft)

        def change(workspace: CandidateWorkspace, now: str) -> None:
            if answer_id is None:
                if len(active_saved(workspace)) >= self._config.max_saved_answers:
                    raise validation_error("saved_answers")
                upsert_saved_answer(workspace, checked, lambda: self._ctx.ids.next("ans"), now)
                return
            current = self._find(workspace, answer_id)
            updated = current.model_copy(
                update={"topic": checked.topic, "question": checked.question, "answer": checked.answer, "updated_at": now}
            )
            workspace.saved_answers = [updated if a.id == answer_id else a for a in workspace.saved_answers]

        return self._change(user_id, change)

    def remove(self, user_id: str, answer_id: str) -> QuestionBank:
        def change(workspace: CandidateWorkspace, now: str) -> None:
            current = self._find(workspace, answer_id)
            workspace.saved_answers = [
                a.model_copy(update={"deleted_at": now}) if a.id == current.id else a for a in workspace.saved_answers
            ]

        return self._change(user_id, change)

    def restore(self, user_id: str, answer_id: str) -> QuestionBank:
        def change(workspace: CandidateWorkspace, now: str) -> None:
            removed = next((a for a in workspace.saved_answers if a.id == answer_id and a.deleted_at is not None), None)
            if removed is None:
                raise not_found("answer")
            workspace.saved_answers = [
                a.model_copy(update={"deleted_at": None, "updated_at": now}) if a.id == answer_id else a for a in workspace.saved_answers
            ]

        return self._change(user_id, change)

    def checked(self, draft: AnswerDraft) -> AnswerDraft:
        question = require_length(clean_text(draft.question), self._config.question_max_length, "question")
        answer = require_length(clean_multiline(draft.answer), self._ctx.settings.validation.answer.max_length, "answer")
        if not question:
            raise validation_error("question")
        if not answer:
            raise validation_error("answer")
        return AnswerDraft(topic=draft.topic, question=question, answer=answer)

    def _find(self, workspace: CandidateWorkspace, answer_id: str) -> SavedAnswer:
        found = next((a for a in active_saved(workspace) if a.id == answer_id), None)
        if found is None:
            raise not_found("answer")
        return found

    def _change(self, user_id: str, change: Callable[[CandidateWorkspace, str], None]) -> QuestionBank:
        workspace = self._ctx.workspaces.get(user_id)
        change(workspace, iso(self._ctx.clock.now()))
        fill_blank_answers(workspace, self._config.keywords())
        self._ctx.workspaces.save(user_id, workspace)
        return self._bank(workspace)

    def _bank(self, workspace: CandidateWorkspace) -> QuestionBank:
        keywords = self._config.keywords()
        groups: dict[str, _Group] = {}
        asked: list[tuple[QuestionAnswer, bool]] = [
            (item, approval.state is ApprovalState.PENDING)
            for approval in reversed(workspace.approvals)
            for item in approval.materials.answers
        ]
        asked += [(item, False) for record in reversed(workspace.applications) for item in record.questions]
        for item, pending in asked:
            key = question_key(item, keywords)
            group = groups.setdefault(key, _Group(topic=detect_topic(item.question, keywords), question=item.question))
            group.count += 1
            if item.answer.strip():
                group.last_answer, group.last_item = item.answer, item
            group.needs_answer = group.needs_answer or (pending and not item.answer.strip())
        saved = {saved_key(a): a.id for a in active_saved(workspace)}
        views = [
            QuestionGroup(
                key=key,
                topic=group.topic,
                question=group.question,
                count=group.count,
                last_answer=group.last_answer,
                last_source=group.last_item.source if group.last_item else None,
                saved_answer_id=saved.get(key),
                needs_answer=group.needs_answer,
            )
            for key, group in groups.items()
        ]
        views.sort(key=lambda g: (not g.needs_answer, -g.count, g.question.lower()))
        return QuestionBank(saved=sorted(active_saved(workspace), key=lambda a: a.updated_at, reverse=True), groups=views)
