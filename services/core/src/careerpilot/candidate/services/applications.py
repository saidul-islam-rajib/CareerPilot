from collections.abc import Callable
from dataclasses import dataclass
from datetime import datetime, timedelta

from careerpilot.candidate.context import CandidateContext
from careerpilot.candidate.models import ApplicationRecord, ApplicationSummary, FollowUpTask, TimelineEntry, UpcomingTask
from careerpilot.candidate.profile_rules import clean_multiline, clean_text, require_length
from careerpilot.platform.clock import iso, parse_iso
from careerpilot.platform.config import TrackingConfig
from careerpilot.platform.enums import ApplicationFilter, OutcomeStatus, SubmissionStatus, TaskKind, TaskStatus, TimelineActor
from careerpilot.platform.errors import not_found, validation_error
from careerpilot.platform.messages import translate

STATUS_GROUPS: dict[ApplicationFilter, frozenset[SubmissionStatus]] = {
    ApplicationFilter.ACTIVE: frozenset(
        {
            SubmissionStatus.NOT_STARTED,
            SubmissionStatus.PREPARING,
            SubmissionStatus.AWAITING_APPROVAL,
            SubmissionStatus.APPROVED_QUEUED,
            SubmissionStatus.SUBMITTING,
        }
    ),
    ApplicationFilter.SUBMITTED: frozenset({SubmissionStatus.SUBMITTED_AWAITING_CONFIRMATION, SubmissionStatus.CONFIRMED}),
    ApplicationFilter.ATTENTION: frozenset(
        {
            SubmissionStatus.AWAITING_USER_INFORMATION,
            SubmissionStatus.MANUAL_ACTION_REQUIRED,
            SubmissionStatus.OUTCOME_UNKNOWN,
            SubmissionStatus.FAILED,
        }
    ),
}
EMPLOYER_OUTCOMES = frozenset(
    {
        OutcomeStatus.UNDER_REVIEW,
        OutcomeStatus.ASSESSMENT,
        OutcomeStatus.INTERVIEW,
        OutcomeStatus.OFFER_RECEIVED,
        OutcomeStatus.ADMITTED,
        OutcomeStatus.CONDITIONALLY_ADMITTED,
        OutcomeStatus.WAITLISTED,
        OutcomeStatus.DEFERRED,
        OutcomeStatus.REJECTED,
    }
)
STATUS_EVENTS: dict[TaskStatus, str] = {
    TaskStatus.OPEN: "timeline.taskReopened",
    TaskStatus.DONE: "timeline.taskCompleted",
    TaskStatus.DISMISSED: "timeline.taskDismissed",
}


@dataclass(frozen=True)
class TaskDraft:
    kind: TaskKind
    title: str
    due_at: str | None
    location: str
    notes: str


def matches_filter(status: SubmissionStatus, application_filter: ApplicationFilter) -> bool:
    return application_filter is ApplicationFilter.ALL or status in STATUS_GROUPS[application_filter]


def task_event(key: str, task: FollowUpTask) -> str:
    return translate(key, {"kind": translate(f"enums.task_kind.{task.kind.value}"), "title": task.title})


def zoned_moment(value: str) -> datetime:
    try:
        moment = parse_iso(value)
    except ValueError as error:
        raise validation_error("due_at") from error
    if moment.tzinfo is None:
        raise validation_error("due_at")
    return moment


def upcoming_tasks(applications: list[ApplicationRecord], now: datetime, limits: TrackingConfig) -> list[UpcomingTask]:
    horizon = now + timedelta(days=limits.upcoming_days)
    due = [
        UpcomingTask(application_id=record.id, organization=record.opportunity.organization, title=record.opportunity.title, task=task)
        for record in applications
        for task in record.tasks
        if task.status is TaskStatus.OPEN and task.due_at is not None and parse_iso(task.due_at) <= horizon
    ]
    due.sort(key=lambda item: item.task.due_at or "")
    return due[: limits.upcoming_limit]


ApplicationListener = Callable[[str, ApplicationRecord], None]


def ignore_application(_user_id: str, _application: ApplicationRecord) -> None:
    return None


class ApplicationService:
    def __init__(self, context: CandidateContext, on_status: ApplicationListener = ignore_application) -> None:
        self._ctx = context
        self._limits = context.settings.tracking
        self._on_status = on_status

    def list(self, user_id: str, application_filter: ApplicationFilter) -> list[ApplicationSummary]:
        applications = [
            a
            for a in self._ctx.workspaces.get(user_id).applications
            if a.archived_at is None and matches_filter(a.submission_status, application_filter)
        ]
        return [a.summary() for a in sorted(applications, key=lambda a: a.updated_at, reverse=True)]

    def get(self, user_id: str, application_id: str) -> ApplicationRecord:
        record = next((a for a in self._ctx.workspaces.get(user_id).applications if a.id == application_id), None)
        if record is None or record.archived_at is not None:
            raise not_found("application")
        return record

    def record_submitted(self, user_id: str, application_id: str) -> ApplicationRecord:
        def change(record: ApplicationRecord, now: str) -> None:
            if record.submission_status is not SubmissionStatus.MANUAL_ACTION_REQUIRED:
                raise validation_error("application_not_manual")
            record.submission_status = SubmissionStatus.SUBMITTED_AWAITING_CONFIRMATION
            record.applied_at = record.applied_at or now
            record.timeline.append(
                TimelineEntry(
                    at=now,
                    actor=TimelineActor.USER,
                    text=translate("timeline.userSubmitted"),
                    status=SubmissionStatus.SUBMITTED_AWAITING_CONFIRMATION,
                )
            )

        record = self._change(user_id, application_id, change)
        self._on_status(user_id, record)
        return record

    def update_outcome(self, user_id: str, application_id: str, outcome: OutcomeStatus, note: str | None) -> ApplicationRecord:
        text = require_length(clean_multiline(note or ""), self._limits.outcome_note_max_length, "note")
        label = translate(f"enums.outcome_status.{outcome.value}")
        event = (
            translate("timeline.outcomeNoted", {"outcome": label, "note": text})
            if text
            else translate("timeline.outcomeSet", {"outcome": label})
        )

        def change(record: ApplicationRecord, now: str) -> None:
            record.outcome_status = outcome
            if outcome in EMPLOYER_OUTCOMES:
                record.last_contact_at = now
            record.timeline.append(TimelineEntry(at=now, actor=TimelineActor.USER, text=event))

        return self._change(user_id, application_id, change)

    def add_task(self, user_id: str, application_id: str, draft: TaskDraft) -> ApplicationRecord:
        fields = self._checked(draft)

        def add(record: ApplicationRecord, now: str) -> None:
            task = FollowUpTask.model_validate({"id": self._ctx.ids.next("task"), "created_at": now, "updated_at": now, **fields})
            record.tasks.append(task)
            record.timeline.append(TimelineEntry(at=now, actor=TimelineActor.USER, text=task_event("timeline.taskAdded", task)))

        return self._change(user_id, application_id, add)

    def edit_task(self, user_id: str, application_id: str, task_id: str, draft: TaskDraft) -> ApplicationRecord:
        fields = self._checked(draft)

        def edit(record: ApplicationRecord, now: str) -> None:
            task = self._task(record, task_id)
            updated = task.model_copy(update={**fields, "updated_at": now})
            record.tasks = [updated if t.id == task_id else t for t in record.tasks]

        return self._change(user_id, application_id, edit)

    def set_task_status(self, user_id: str, application_id: str, task_id: str, status: TaskStatus) -> ApplicationRecord:
        def change(record: ApplicationRecord, now: str) -> None:
            task = self._task(record, task_id)
            updated = task.model_copy(update={"status": status, "updated_at": now})
            record.tasks = [updated if t.id == task_id else t for t in record.tasks]
            record.timeline.append(TimelineEntry(at=now, actor=TimelineActor.USER, text=task_event(STATUS_EVENTS[status], updated)))

        return self._change(user_id, application_id, change)

    def _checked(self, draft: TaskDraft) -> dict[str, object]:
        title = clean_text(draft.title)
        if not title:
            raise validation_error("title")
        return {
            "kind": draft.kind,
            "title": require_length(title, self._limits.task_title_max_length, "title"),
            "due_at": iso(zoned_moment(draft.due_at)) if draft.due_at else None,
            "location": require_length(clean_text(draft.location), self._limits.task_location_max_length, "location"),
            "notes": require_length(clean_multiline(draft.notes), self._limits.task_notes_max_length, "notes"),
        }

    @staticmethod
    def _task(record: ApplicationRecord, task_id: str) -> FollowUpTask:
        task = next((t for t in record.tasks if t.id == task_id), None)
        if task is None:
            raise not_found("task")
        return task

    def _change(self, user_id: str, application_id: str, change: Callable[[ApplicationRecord, str], None]) -> ApplicationRecord:
        workspace = self._ctx.workspaces.get(user_id)
        record = next((a for a in workspace.applications if a.id == application_id), None)
        if record is None:
            raise not_found("application")
        now = iso(self._ctx.clock.now())
        change(record, now)
        record.updated_at = now
        self._ctx.workspaces.save(user_id, workspace)
        return record
