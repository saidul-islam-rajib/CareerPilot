from collections.abc import Callable
from dataclasses import dataclass

from careerpilot.candidate.models import ApplicationRecord, TimelineEntry
from careerpilot.candidate.ports import WorkspaceRepository
from careerpilot.candidate.services.answers import AnswerDraft, AnswerService
from careerpilot.candidate.services.applications import ApplicationService
from careerpilot.platform.clock import Clock, IdGenerator, iso
from careerpilot.platform.enums import AnswerTopic, SubmissionStatus, TimelineActor
from careerpilot.platform.errors import not_found, validation_error
from careerpilot.platform.messages import translate
from careerpilot.portal.accounts import PortalAccounts
from careerpilot.portal.config import PortalsConfig
from careerpilot.portal.enums import AttemptState, Failure, RecordKind
from careerpilot.portal.hosts import HostPolicies
from careerpilot.portal.models import (
    AccountInput,
    AccountSecret,
    AccountView,
    AttemptView,
    AutopilotInput,
    AutopilotState,
    AutopilotSummary,
    HostInput,
    HostRecord,
    Permissions,
    PortalSettings,
    ResumeInput,
)
from careerpilot.portal.ports import PortalRecordRepository
from careerpilot.portal.store import RecordStore

SETTINGS_KEY = "settings"


@dataclass(frozen=True)
class PortalContext:
    config: PortalsConfig
    clock: Clock
    ids: IdGenerator
    records: PortalRecordRepository
    workspaces: WorkspaceRepository
    accounts: PortalAccounts
    hosts: HostPolicies
    answers: AnswerService
    applications: ApplicationService
    live: Callable[[], bool]
    mail_connected: Callable[[str], bool]


class PortalService:
    def __init__(self, context: PortalContext) -> None:
        self._ctx = context
        self._settings = RecordStore(context.records, RecordKind.SETTINGS, PortalSettings)
        self._attempts = RecordStore(context.records, RecordKind.ATTEMPT, AttemptView)

    def settings_of(self, user_id: str) -> PortalSettings:
        return self._settings.get(user_id, SETTINGS_KEY) or PortalSettings()

    def autopilot(self, user_id: str) -> AutopilotState:
        workspace = self._ctx.workspaces.get(user_id)
        rules = workspace.preferences.automation.active_rules()
        summary = AutopilotSummary(
            summary_version=self._ctx.config.summary_version,
            user_only_steps=self._ctx.config.user_only_steps,
            routes=[r.value for r in self._ctx.config.routes],
            rule_names=[r.name for r in rules],
            document_names=[d.name for d in workspace.profile.active_documents()],
            live=self._ctx.live(),
            mail_connected=self._ctx.mail_connected(user_id),
        )
        return AutopilotState(settings=self.settings_of(user_id), summary=summary)

    def enable(self, user_id: str, body: AutopilotInput) -> AutopilotState:
        if not body.acknowledged:
            raise validation_error(Failure.NOT_ACKNOWLEDGED.value)
        email = (body.account_email or "").strip() or None
        if body.allow_account_creation and email is None:
            raise validation_error("account_email")
        permissions = Permissions(
            allow_account_creation=body.allow_account_creation,
            account_email=email,
            accept_terms=body.accept_terms,
            accept_privacy=body.accept_privacy,
            allow_email_verification=body.allow_email_verification,
        )
        settings = PortalSettings(
            enabled=True,
            enabled_at=iso(self._ctx.clock.now()),
            summary_version=self._ctx.config.summary_version,
            permissions=permissions,
        )
        self._settings.save(user_id, SETTINGS_KEY, settings)
        return self.autopilot(user_id)

    def disable(self, user_id: str) -> AutopilotState:
        current = self.settings_of(user_id)
        self._settings.save(user_id, SETTINGS_KEY, current.model_copy(update={"enabled": False}))
        return self.autopilot(user_id)

    def accounts(self, user_id: str) -> list[AccountView]:
        return self._ctx.accounts.views(user_id)

    def add_account(self, user_id: str, body: AccountInput) -> AccountView:
        return self._ctx.accounts.import_credential(user_id, body)

    def reveal_account(self, user_id: str, account_id: str) -> AccountSecret:
        return self._ctx.accounts.reveal(user_id, account_id)

    def export_accounts(self, user_id: str) -> list[AccountSecret]:
        return self._ctx.accounts.export(user_id)

    def delete_account(self, user_id: str, account_id: str) -> None:
        self._ctx.accounts.remove(user_id, account_id)

    def attempt(self, user_id: str, application_id: str) -> AttemptView:
        found = self._attempts.get(user_id, application_id)
        if found is None:
            raise not_found(Failure.NOT_FOUND.value)
        return found

    def resume(self, user_id: str, application_id: str, body: ResumeInput) -> ApplicationRecord:
        attempt = self.attempt(user_id, application_id)
        if attempt.submit_clicked:
            raise validation_error(Failure.ALREADY_SUBMITTED.value)
        application = self._ctx.applications.get(user_id, application_id)
        if application.submission_status is not SubmissionStatus.MANUAL_ACTION_REQUIRED or attempt.state is AttemptState.CONFIRMED:
            raise validation_error(Failure.NOT_RESUMABLE.value)
        for answer in body.answers:
            self._ctx.answers.save(user_id, AnswerDraft(topic=AnswerTopic.OTHER, question=answer.label, answer=answer.answer))
        self._attempts.save(user_id, application_id, attempt.model_copy(update={"pending": [], "stop": None, "state": AttemptState.STOPPED}))
        return self._requeue(user_id, application_id)

    def complete(self, user_id: str, application_id: str) -> ApplicationRecord:
        attempt = self._attempts.get(user_id, application_id)
        record = self._ctx.applications.record_submitted(user_id, application_id)
        if attempt is not None:
            self._attempts.save(user_id, application_id, attempt.model_copy(update={"submit_clicked": True}))
        return record

    def hosts(self) -> list[HostRecord]:
        return self._ctx.hosts.records()

    def decide_host(self, host: str, body: HostInput) -> HostRecord:
        return self._ctx.hosts.decide(host, body)

    def _requeue(self, user_id: str, application_id: str) -> ApplicationRecord:
        workspace = self._ctx.workspaces.get(user_id)
        application = next(a for a in workspace.applications if a.id == application_id)
        now = iso(self._ctx.clock.now())
        application.submission_status = SubmissionStatus.APPROVED_QUEUED
        application.updated_at = now
        application.timeline.append(
            TimelineEntry(at=now, actor=TimelineActor.USER, text=translate("portal.timeline.resumed"), status=SubmissionStatus.APPROVED_QUEUED)
        )
        self._ctx.workspaces.save(user_id, workspace)
        return application
