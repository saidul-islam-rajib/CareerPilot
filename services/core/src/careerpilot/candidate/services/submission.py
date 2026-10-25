from collections.abc import Callable
from dataclasses import dataclass
from datetime import datetime, time, timedelta
from zoneinfo import ZoneInfo

from careerpilot.administration.models import PlatformSettings
from careerpilot.candidate.context import CandidateContext
from careerpilot.candidate.models import ApplicationRecord, Evidence, ProfileDocument, SentEmail, SentFile, TimelineEntry
from careerpilot.candidate.ports import CandidateWorkspace
from careerpilot.candidate.submission_checks import EMAIL_CHECKS, FAILURE_STATUS, SubmissionCase, first_failure
from careerpilot.platform.clock import iso, parse_iso
from careerpilot.platform.email_delivery import Attachment, DeliveryError, DeliveryUncertainError, EmailSender, OutgoingEmail
from careerpilot.platform.enums import (
    ContactKind,
    EmergencyStopScope,
    PauseScope,
    SubmissionHold,
    SubmissionStatus,
    SubmissionWindowKind,
    TimelineActor,
)
from careerpilot.platform.files import PDF, FileStorage
from careerpilot.platform.messages import translate

TIME_SEPARATOR = ":"


@dataclass(frozen=True)
class QueuedApplication:
    user_id: str
    application_id: str


@dataclass(frozen=True)
class SubmissionResult:
    status: SubmissionStatus
    hold: SubmissionHold | None = None


@dataclass(frozen=True)
class SubmissionContext:
    candidate: CandidateContext
    platform: Callable[[], PlatformSettings]
    sender: EmailSender
    storage: FileStorage


def _parse_time(value: str | None) -> time | None:
    if not value:
        return None
    hours, minutes = value.split(TIME_SEPARATOR, 1)
    return time(int(hours), int(minutes))


def within_window(workspace: CandidateWorkspace, now: datetime) -> bool:
    window = workspace.preferences.submission_window
    if window.kind is SubmissionWindowKind.AS_SOON_AS_READY:
        return True
    start, end = _parse_time(window.start), _parse_time(window.end)
    if start is None or end is None:
        return True
    local = now.astimezone(ZoneInfo(workspace.preferences.time_zone)).time()
    return start <= local < end if start <= end else local >= start or local < end


class SubmissionService:
    def __init__(self, context: SubmissionContext) -> None:
        self._ctx = context
        self._candidate = context.candidate
        self._config = context.candidate.settings.submission

    def due(self) -> list[QueuedApplication]:
        return [
            QueuedApplication(user_id, application.id)
            for user_id in self._candidate.accounts.active_ids()
            for application in self._candidate.workspaces.get(user_id).applications
            if application.submission_status is SubmissionStatus.APPROVED_QUEUED
        ]

    def submit(self, user_id: str, application_id: str) -> SubmissionResult:
        workspace = self._candidate.workspaces.get(user_id)
        application = next((a for a in workspace.applications if a.id == application_id), None)
        if application is None or application.submission_status is not SubmissionStatus.APPROVED_QUEUED:
            return SubmissionResult(application.submission_status if application else SubmissionStatus.CANCELLED)
        hold = self._hold(user_id, workspace, application)
        if hold is not None:
            return SubmissionResult(application.submission_status, hold)
        if application.route not in self._config.automatable_routes:
            self._move(application, SubmissionStatus.MANUAL_ACTION_REQUIRED, translate("timeline.portalManual"))
        else:
            self._submit_email(user_id, workspace, application)
        self._candidate.workspaces.save(user_id, workspace)
        return SubmissionResult(application.submission_status)

    def confirm_sent(self) -> int:
        now = self._candidate.clock.now()
        bounce_window = timedelta(hours=self._config.bounce_window_hours)
        stuck_after = timedelta(minutes=self._config.stuck_after_minutes)
        changed = 0
        for user_id in self._candidate.accounts.active_ids():
            workspace = self._candidate.workspaces.get(user_id)
            updates = 0
            for application in workspace.applications:
                age = now - parse_iso(application.updated_at)
                if application.submission_status is SubmissionStatus.SUBMITTED_AWAITING_CONFIRMATION and age >= bounce_window:
                    hours = {"hours": self._config.bounce_window_hours}
                    application.evidence.append(Evidence(text=translate("submission.evidenceConfirmed", hours), at=iso(now)))
                    self._move(application, SubmissionStatus.CONFIRMED, translate("timeline.emailConfirmed", hours))
                    updates += 1
                elif application.submission_status is SubmissionStatus.SUBMITTING and age >= stuck_after:
                    self._move(application, SubmissionStatus.OUTCOME_UNKNOWN, translate("timeline.outcomeUnknown"))
                    updates += 1
            if updates:
                self._candidate.workspaces.save(user_id, workspace)
                changed += updates
        return changed

    def _hold(self, user_id: str, workspace: CandidateWorkspace, application: ApplicationRecord) -> SubmissionHold | None:
        now = self._candidate.clock.now()
        settings = self._ctx.platform()
        stop = settings.emergency_stop
        stopped = stop.active and (
            stop.scope in (None, EmergencyStopScope.ALL_USERS)
            or (stop.scope is EmergencyStopScope.ROUTE and stop.target == application.route)
        )
        pause = workspace.preferences.pause
        paused = pause is not None and pause.scope is PauseScope.ALL and (pause.until is None or parse_iso(pause.until) > now)
        checks = [
            (stopped, SubmissionHold.EMERGENCY_STOP),
            (paused, SubmissionHold.PAUSED),
            (not within_window(workspace, now), SubmissionHold.OUTSIDE_WINDOW),
            (self._submitted_today(workspace, now) >= settings.daily_application_cap, SubmissionHold.DAILY_LIMIT),
        ]
        return next((hold for blocked, hold in checks if blocked), None)

    def _submitted_today(self, workspace: CandidateWorkspace, now: datetime) -> int:
        zone = ZoneInfo(workspace.preferences.time_zone)
        today = now.astimezone(zone).date()
        return sum(1 for a in workspace.applications if a.applied_at and parse_iso(a.applied_at).astimezone(zone).date() == today)

    def _submit_email(self, user_id: str, workspace: CandidateWorkspace, application: ApplicationRecord) -> None:
        if application.emails:
            self._move(application, SubmissionStatus.SUBMITTED_AWAITING_CONFIRMATION, translate("timeline.submitting"))
            return
        opportunity = self._candidate.opportunities.get(application.opportunity.id)
        document = self._document(workspace, application)
        cv = self._ctx.storage.get(document.current.key) if document else None
        if opportunity is None:
            self._move(application, SubmissionStatus.FAILED, translate("submission.failures.missing_recipient"))
            return
        case = SubmissionCase(
            profile=workspace.profile,
            application=application,
            opportunity=opportunity,
            other_applications=[a for a in workspace.applications if a.id != application.id],
            cv=cv,
            max_document_bytes=self._candidate.settings.profile.uploads.max_document_bytes,
            now=self._candidate.clock.now(),
        )
        failure = first_failure(case, EMAIL_CHECKS)
        if failure is not None:
            reason = translate(f"submission.failures.{failure.value}")
            self._move(application, FAILURE_STATUS[failure], translate("timeline.checkFailed", {"reason": reason}))
            return
        recipient = opportunity.application_email
        if document is None or cv is None or recipient is None:
            return
        self._move(application, SubmissionStatus.SUBMITTING, translate("timeline.submitting"))
        self._candidate.workspaces.save(user_id, workspace)
        self._deliver(application, self._email(workspace, application, recipient, document, cv), document)

    def _deliver(self, application: ApplicationRecord, email: OutgoingEmail, document: ProfileDocument) -> None:
        now = iso(self._candidate.clock.now())
        try:
            receipt = self._ctx.sender.send(email)
        except DeliveryError as error:
            application.attempts += 1
            if error.retryable and application.attempts < self._config.max_attempts:
                self._move(application, SubmissionStatus.APPROVED_QUEUED, translate("timeline.retryScheduled", {"reason": error.reason}))
            else:
                params: dict[str, str | int] = {"attempts": application.attempts, "reason": error.reason}
                self._move(application, SubmissionStatus.FAILED, translate("timeline.sendFailed", params))
            return
        except DeliveryUncertainError:
            self._move(application, SubmissionStatus.OUTCOME_UNKNOWN, translate("timeline.outcomeUnknown"))
            return
        attachment = email.attachments[0]
        application.applied_at = now
        application.emails = [SentEmail(subject=email.subject, to=email.to, sent_at=now, body=email.body)]
        application.files = [SentFile(name=attachment.name, version=document.current.version, size_bytes=len(attachment.content))]
        application.evidence.append(Evidence(text=translate("submission.evidenceAccepted", {"messageId": receipt.message_id}), at=now))
        sent = translate("timeline.emailSent", {"to": email.to, "attachment": attachment.name})
        self._move(application, SubmissionStatus.SUBMITTED_AWAITING_CONFIRMATION, sent)

    def _email(
        self, workspace: CandidateWorkspace, application: ApplicationRecord, to: str, document: ProfileDocument, cv: bytes
    ) -> OutgoingEmail:
        profile = workspace.profile
        names = {"fullName": profile.full_name, "title": application.opportunity.title}
        emails = [c for c in profile.active_contacts() if c.kind is ContactKind.EMAIL]
        reply_to = next((c.value for c in emails if c.is_primary), emails[0].value if emails else "")
        letter = application.materials.cover_letter if application.materials else ""
        return OutgoingEmail(
            sender_name=translate("applications.senderName", names),
            sender_address=self._config.sender_address,
            reply_to=reply_to,
            to=to,
            subject=translate("applications.emailSubject", names),
            body=letter,
            attachments=[Attachment(name=document.current.file_name, content=cv, content_type=PDF)],
        )

    @staticmethod
    def _document(workspace: CandidateWorkspace, application: ApplicationRecord) -> ProfileDocument | None:
        if application.materials is None:
            return None
        cv = application.materials.cv
        documents = workspace.profile.active_documents()
        if cv.document_id:
            return next((d for d in documents if d.id == cv.document_id), None)
        return next((d for d in documents if d.name == cv.name), None)

    def _move(self, application: ApplicationRecord, status: SubmissionStatus, text: str) -> None:
        now = iso(self._candidate.clock.now())
        application.submission_status = status
        application.updated_at = now
        application.timeline.append(TimelineEntry(at=now, actor=TimelineActor.SYSTEM, text=text, status=status))
