from dataclasses import dataclass
from datetime import datetime

from careerpilot.candidate.models import ApplicationRecord, Evidence, FollowUpTask, TimelineEntry
from careerpilot.integrations.dates import MomentFinder
from careerpilot.integrations.matching import Match
from careerpilot.integrations.models import Classification, MailMessage
from careerpilot.platform.clock import IdGenerator, iso
from careerpilot.platform.config import MailMatchingConfig, ReplyClassificationConfig, SyncConfig
from careerpilot.platform.enums import (
    ReplyDisposition,
    ReplyKind,
    SubmissionStatus,
    TaskKind,
    TaskStatus,
    TimelineActor,
)
from careerpilot.platform.messages import translate

TASK_ID_PREFIX = "task"
ELLIPSIS = "..."


@dataclass(frozen=True)
class AppliedReply:
    disposition: ReplyDisposition
    confirmed: bool


@dataclass(frozen=True)
class IncomingReply:
    message: MailMessage
    match: Match
    found: Classification
    link: str
    time_zone: str


def clip(value: str, limit: int) -> str:
    cleaned = " ".join(value.split())
    return cleaned if len(cleaned) <= limit else cleaned[: limit - len(ELLIPSIS)].rstrip() + ELLIPSIS


class ReplyApplier:
    def __init__(
        self,
        classification: ReplyClassificationConfig,
        matching: MailMatchingConfig,
        sync: SyncConfig,
        finder: MomentFinder,
        ids: IdGenerator,
    ) -> None:
        self._classification = classification
        self._matching = matching
        self._sync = sync
        self._finder = finder
        self._ids = ids
        self._outcomes = {entry.kind: entry.outcome for entry in classification.kinds}

    def apply(self, application: ApplicationRecord, reply: IncomingReply, now: datetime) -> AppliedReply:
        received = iso(reply.message.received_at)
        disposition = self._disposition(application, reply.found)
        if disposition is ReplyDisposition.APPLIED:
            application.outcome_status = self._outcomes[reply.found.kind]
        application.timeline.append(
            TimelineEntry(
                at=received,
                actor=TimelineActor.EMPLOYER,
                text=self._text(reply, disposition),
                link=reply.link,
            )
        )
        if application.last_contact_at is None or application.last_contact_at < received:
            application.last_contact_at = received
        if reply.found.kind is ReplyKind.INTERVIEW_INVITE and reply.found.confidence >= self._classification.apply_min_confidence:
            self._interview_task(application, reply, now)
        confirmed = self._confirm(application, reply, received)
        application.updated_at = iso(now)
        return AppliedReply(disposition, confirmed)

    def _disposition(self, application: ApplicationRecord, found: Classification) -> ReplyDisposition:
        if found.kind in self._classification.suggest_only_kinds:
            return ReplyDisposition.SUGGESTED
        progress = self._classification.outcome_progress
        current, target = application.outcome_status, self._outcomes.get(found.kind)
        if target is None or current not in progress or target not in progress:
            return ReplyDisposition.RECORDED
        if found.confidence >= self._classification.apply_min_confidence and progress.index(target) > progress.index(current):
            return ReplyDisposition.APPLIED
        return ReplyDisposition.RECORDED

    def _text(self, reply: IncomingReply, disposition: ReplyDisposition) -> str:
        names = {
            "kind": translate(f"enums.reply_kind.{reply.found.kind.value}"),
            "sender": reply.message.sender_name or reply.message.sender_address,
            "subject": clip(reply.message.subject, self._sync.max_subject_chars),
        }
        return translate(f"integrations.timeline.{disposition.value}", names)

    def _confirm(self, application: ApplicationRecord, reply: IncomingReply, received: str) -> bool:
        waiting = application.submission_status is SubmissionStatus.SUBMITTED_AWAITING_CONFIRMATION
        if not waiting or reply.match.strength < self._matching.domain_strength:
            return False
        application.evidence.append(Evidence(text=translate("integrations.evidenceReply"), at=received))
        application.submission_status = SubmissionStatus.CONFIRMED
        application.timeline.append(
            TimelineEntry(
                at=received,
                actor=TimelineActor.SYSTEM,
                text=translate("integrations.timeline.confirmed"),
                status=SubmissionStatus.CONFIRMED,
                link=reply.link,
            )
        )
        return True

    def _interview_task(self, application: ApplicationRecord, reply: IncomingReply, now: datetime) -> None:
        moment = self._finder.find(f"{reply.message.subject} {reply.message.body}", reply.time_zone, now)
        due_at = iso(moment) if moment else None
        open_interviews = [t for t in application.tasks if t.kind is TaskKind.INTERVIEW and t.status is TaskStatus.OPEN]
        if due_at is None and open_interviews:
            return
        if due_at is not None and any(t.due_at == due_at for t in open_interviews):
            return
        stamp = iso(now)
        application.tasks.append(
            FollowUpTask(
                id=self._ids.next(TASK_ID_PREFIX),
                kind=TaskKind.INTERVIEW,
                title=translate("integrations.interviewTaskTitle", {"organization": application.opportunity.organization}),
                due_at=due_at,
                notes=translate("integrations.interviewTaskNotes", {"link": reply.link}),
                status=TaskStatus.OPEN,
                created_at=stamp,
                updated_at=stamp,
            )
        )
