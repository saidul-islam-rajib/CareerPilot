import logging
from collections.abc import Callable
from dataclasses import dataclass, replace
from datetime import timedelta

from careerpilot.candidate.models import ApplicationRecord
from careerpilot.candidate.ports import CandidateWorkspace, OpportunityRepository, WorkspaceRepository
from careerpilot.candidate.services.applications import STATUS_GROUPS
from careerpilot.integrations.calendar_sync import CalendarSync
from careerpilot.integrations.connections import ConnectionContext, TokenKeeper
from careerpilot.integrations.matching import ApplicationMatcher
from careerpilot.integrations.models import ConnectionRecord, MailMessage, SyncedMessage, SyncSummary, Targets
from careerpilot.integrations.ports import GoogleError, ReplyClassifier, SyncedMessageRepository
from careerpilot.integrations.replies import IncomingReply, ReplyApplier
from careerpilot.messaging.notifications import NotificationService
from careerpilot.platform.clock import iso, parse_iso
from careerpilot.platform.enums import (
    ApplicationFilter,
    ConnectionStatus,
    IntegrationProvider,
    NotificationKind,
    NotificationTarget,
    ReplyDisposition,
    SubmissionStatus,
    SyncFailure,
)
from careerpilot.platform.messages import translate

logger = logging.getLogger(__name__)
SYNCED_ID_PREFIX = "syn"
REPLY_STATUSES = STATUS_GROUPS[ApplicationFilter.SUBMITTED] | {SubmissionStatus.OUTCOME_UNKNOWN}
ApplicationListener = Callable[[str, ApplicationRecord], None]


@dataclass(frozen=True)
class SyncContext:
    connection: ConnectionContext
    workspaces: WorkspaceRepository
    opportunities: OpportunityRepository
    synced: SyncedMessageRepository
    matcher: ApplicationMatcher
    classifier: ReplyClassifier
    applier: ReplyApplier
    calendar: CalendarSync
    notifications: NotificationService
    on_status: ApplicationListener


@dataclass(frozen=True)
class MailTarget:
    user_id: str
    workspace: CandidateWorkspace
    targets: dict[str, Targets]


class SyncService:
    def __init__(self, context: SyncContext) -> None:
        self._ctx = context
        self._cfg = context.connection.config
        self._keeper = TokenKeeper(context.connection)

    def sync_all(self) -> SyncSummary:
        messages = events = 0
        records = self._ctx.connection.connections.all_active(IntegrationProvider.GOOGLE)
        for record in records[: self._cfg.sync.max_users_per_run]:
            try:
                result = self.sync_user(record.user_id)
            except Exception:
                logger.exception("integration sync failed for one user")
                continue
            messages += result.messages
            events += result.events
        return SyncSummary(messages=messages, events=events)

    def sync_user(self, user_id: str) -> SyncSummary:
        record = self._ctx.connection.connections.active(user_id, IntegrationProvider.GOOGLE)
        if record is None or record.status is not ConnectionStatus.CONNECTED:
            return SyncSummary(messages=0, events=0)
        try:
            return self._run(user_id, record)
        except GoogleError as error:
            self._failed(user_id, error.failure)
            return SyncSummary(messages=0, events=0)

    def _run(self, user_id: str, record: ConnectionRecord) -> SyncSummary:
        google = self._cfg.google
        current, token = self._keeper.access(record)
        messages = events = 0
        failure: SyncFailure | None = None
        if google.mail_scope in current.scopes:
            messages = self._mail(user_id, current, token)
        else:
            failure = SyncFailure.MISSING_MAIL_ACCESS
        if google.calendar_scope in current.scopes:
            events = self._ctx.calendar.sync(user_id, token)
        done = self._ctx.connection.connections.active(user_id, IntegrationProvider.GOOGLE) or current
        stamp = iso(self._ctx.connection.clock.now())
        self._ctx.connection.connections.save(done.model_copy(update={"last_sync_at": stamp, "last_error": failure}))
        return SyncSummary(messages=messages, events=events)

    def _mail(self, user_id: str, record: ConnectionRecord, token: str) -> int:
        workspace = self._ctx.workspaces.get(user_id)
        targets = self._targets(workspace)
        if not targets:
            return 0
        gateway = self._ctx.connection.gateway
        found = gateway.find_messages(token, self._query(record, targets), self._cfg.sync.max_messages_per_run)
        incoming = [m for m in (gateway.read_message(token, i) for i in found if not self._ctx.synced.seen(user_id, i)) if m]
        incoming.sort(key=lambda message: message.received_at)
        recorded = [self._record(user_id, workspace, targets, message) for message in incoming]
        handled = [item for item in recorded if item is not None]
        if handled:
            self._ctx.workspaces.save(user_id, workspace)
        for application, stored, confirmed in handled:
            self._ctx.synced.add(stored)
            self._notify(user_id, application, stored)
            if confirmed:
                self._ctx.on_status(user_id, application)
        return len(handled)

    def _record(
        self, user_id: str, workspace: CandidateWorkspace, targets: dict[str, Targets], message: MailMessage
    ) -> tuple[ApplicationRecord, SyncedMessage, bool] | None:
        match = self._ctx.matcher.best(message, targets)
        if match is None:
            return None
        application = next(a for a in workspace.applications if a.id == match.application_id)
        body = message.body[: self._cfg.sync.max_body_chars]
        found = self._ctx.classifier.classify(message.subject, body)
        link = self._cfg.google.mail_link_template.format(message_id=message.id)
        reply = IncomingReply(
            message=replace(message, body=body), match=match, found=found, link=link, time_zone=workspace.preferences.time_zone
        )
        applied = self._ctx.applier.apply(application, reply, self._ctx.connection.clock.now())
        stored = SyncedMessage(
            id=self._ctx.connection.ids.next(SYNCED_ID_PREFIX),
            user_id=user_id,
            message_id=message.id,
            application_id=application.id,
            received_at=iso(message.received_at),
            kind=found.kind,
            disposition=applied.disposition,
            confidence=found.confidence,
            subject=message.subject[: self._cfg.sync.max_subject_chars],
        )
        return application, stored, applied.confirmed

    def _targets(self, workspace: CandidateWorkspace) -> dict[str, Targets]:
        def contact(opportunity_id: str) -> str | None:
            found = self._ctx.opportunities.get(opportunity_id)
            return found.application_email if found else None

        return {
            a.id: self._ctx.matcher.targets(a, contact)
            for a in workspace.applications
            if a.archived_at is None and a.submission_status in REPLY_STATUSES
        }

    def _query(self, record: ConnectionRecord, targets: dict[str, Targets]) -> str:
        sync = self._cfg.sync
        now = self._ctx.connection.clock.now()
        since = (
            parse_iso(record.last_sync_at) - timedelta(hours=sync.overlap_hours)
            if record.last_sync_at
            else now - timedelta(days=sync.lookback_days)
        )
        senders = [sync.sender_template.format(sender=term) for term in self._ctx.matcher.sender_terms(targets)]
        keywords = sync.any_separator.join(self._cfg.matching.subject_keywords)
        terms = sync.any_separator.join([*senders, sync.subject_template.format(keywords=keywords)])
        return sync.query_template.format(after=int(since.timestamp()), terms=terms)

    def _notify(self, user_id: str, application: ApplicationRecord, stored: SyncedMessage) -> None:
        suggested = stored.disposition is ReplyDisposition.SUGGESTED
        scope = "suggested" if suggested else "reply"
        names = {
            "kind": translate(f"enums.reply_kind.{stored.kind.value}"),
            "title": application.opportunity.title,
            "organization": application.opportunity.organization,
        }
        self._ctx.notifications.notify(
            user_id,
            NotificationKind.APPLICATION_REPLY,
            translate(f"integrations.notification.{scope}.title", names),
            translate(f"integrations.notification.{scope}.body", names),
            (NotificationTarget.APPLICATION, application.id),
        )

    def _failed(self, user_id: str, failure: SyncFailure) -> None:
        repo = self._ctx.connection.connections
        record = repo.active(user_id, IntegrationProvider.GOOGLE)
        if record is None:
            return
        revoked = failure is SyncFailure.TOKEN_REVOKED
        status = ConnectionStatus.NEEDS_RECONNECT if revoked else record.status
        repo.save(
            record.model_copy(update={"status": status, "last_error": failure, "attention_notified": record.attention_notified or revoked})
        )
        if revoked and not record.attention_notified:
            self._ctx.notifications.notify(
                user_id,
                NotificationKind.INTEGRATION_ATTENTION,
                translate("integrations.notification.attention.title"),
                translate("integrations.notification.attention.body"),
                (NotificationTarget.INTEGRATION, record.id),
            )
