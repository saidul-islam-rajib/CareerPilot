from collections.abc import Callable
from dataclasses import dataclass

from careerpilot.automation.policy import AutomationPolicy
from careerpilot.candidate.models import ApplicationRecord, Evidence, OpportunityDetail, TimelineEntry
from careerpilot.candidate.ports import CandidateWorkspace, OpportunityRepository, WorkspaceRepository
from careerpilot.platform.clock import Clock, IdGenerator, iso
from careerpilot.platform.enums import NotificationKind, NotificationTarget, SubmissionHold, SubmissionStatus, TimelineActor
from careerpilot.platform.files import FileStorage
from careerpilot.platform.messages import translate
from careerpilot.portal.accounts import PortalAccounts
from careerpilot.portal.config import PortalsConfig
from careerpilot.portal.driver import BrowserSession
from careerpilot.portal.enums import AttemptState, FlowOutcome, HostPolicy, RecordKind, RunMode, StopReason
from careerpilot.portal.facts import profile_facts
from careerpilot.portal.flow import CvFile, FlowDeps, FlowInput, FlowResult, PortalFlow
from careerpilot.portal.hosts import HostPolicies, host_of
from careerpilot.portal.models import AttemptView, PortalSettings
from careerpilot.portal.permissions import effective_permissions
from careerpilot.portal.ports import PortalRecordRepository
from careerpilot.portal.store import RecordStore
from careerpilot.portal.throttle import HostThrottle
from careerpilot.portal.verification import VerificationFetcher

SETTINGS_KEY = "settings"
HOST_STOPS = {HostPolicy.BLOCKED: StopReason.HOST_BLOCKED, HostPolicy.REVIEW: StopReason.HOST_REVIEW}
STATUS_OF_OUTCOME = {
    FlowOutcome.CONFIRMED: SubmissionStatus.CONFIRMED,
    FlowOutcome.UNCERTAIN: SubmissionStatus.OUTCOME_UNKNOWN,
    FlowOutcome.STOPPED: SubmissionStatus.MANUAL_ACTION_REQUIRED,
    FlowOutcome.READY: SubmissionStatus.MANUAL_ACTION_REQUIRED,
}
STATE_OF_OUTCOME = {
    FlowOutcome.CONFIRMED: AttemptState.CONFIRMED,
    FlowOutcome.UNCERTAIN: AttemptState.UNCERTAIN,
    FlowOutcome.STOPPED: AttemptState.STOPPED,
    FlowOutcome.READY: AttemptState.READINESS_ONLY,
}


@dataclass(frozen=True)
class RunReport:
    application_id: str
    status: SubmissionStatus
    stop: StopReason | None = None
    hold: SubmissionHold | None = None


@dataclass(frozen=True)
class RunnerContext:
    config: PortalsConfig
    clock: Clock
    ids: IdGenerator
    records: PortalRecordRepository
    workspaces: WorkspaceRepository
    opportunities: OpportunityRepository
    storage: FileStorage
    accounts: PortalAccounts
    hosts: HostPolicies
    throttle: HostThrottle
    browser: BrowserSession
    verifier: VerificationFetcher
    policy: AutomationPolicy
    live: Callable[[], bool]
    hold_of: Callable[[str, str], SubmissionHold | None]
    notify: Callable[[str, NotificationKind, str, str, tuple[NotificationTarget, str]], None]
    on_status: Callable[[str, ApplicationRecord], None]


class PortalRunner:
    def __init__(self, context: RunnerContext) -> None:
        self._ctx = context
        self._cfg = context.config
        self._attempts = RecordStore(context.records, RecordKind.ATTEMPT, AttemptView)
        self._settings = RecordStore(context.records, RecordKind.SETTINGS, PortalSettings)

    def due(self) -> list[tuple[str, str]]:
        found: list[tuple[str, str]] = []
        for user_id, settings in self._settings.everyone():
            if not settings.enabled:
                continue
            workspace = self._ctx.workspaces.get(user_id)
            found.extend((user_id, a.id) for a in workspace.applications if self.is_portal_job(a) and a.archived_at is None)
        return found

    def is_portal_job(self, application: ApplicationRecord) -> bool:
        return application.route in {route.value for route in self._cfg.routes} and application.submission_status is SubmissionStatus.APPROVED_QUEUED

    def run(self, user_id: str, application_id: str) -> RunReport:
        workspace = self._ctx.workspaces.get(user_id)
        application = next((a for a in workspace.applications if a.id == application_id), None)
        if application is None or not self.is_portal_job(application):
            return RunReport(application_id, application.submission_status if application else SubmissionStatus.CANCELLED)
        settings = self._settings.get(user_id, SETTINGS_KEY) or PortalSettings()
        previous = self._attempts.get(user_id, application_id)
        if previous is not None and previous.submit_clicked:
            return self._finish_uncertain(user_id, workspace, application, previous)
        if not settings.enabled:
            return self._stop(user_id, workspace, application, StopReason.AUTOPILOT_OFF)
        hold = self._ctx.hold_of(user_id, application_id)
        if hold is not None:
            return RunReport(application_id, application.submission_status, hold=hold)
        return self._attempt(user_id, workspace, application, settings, previous)

    def _attempt(
        self, user_id: str, workspace: CandidateWorkspace, application: ApplicationRecord, settings: PortalSettings, previous: AttemptView | None
    ) -> RunReport:
        opportunity = self._ctx.opportunities.get(application.opportunity.id)
        if opportunity is None:
            return self._stop(user_id, workspace, application, StopReason.CLOSED)
        url = opportunity.source.url
        host = host_of(url)
        blocked = HOST_STOPS.get(self._ctx.hosts.observe(host).policy)
        if blocked is not None:
            return self._stop(user_id, workspace, application, blocked, url)
        live = self._ctx.live()
        attempt = self._begin(user_id, workspace, application, previous, url, host, live)
        result = self._execute(user_id, workspace, application, settings, opportunity, attempt, live)
        return self._finish(user_id, workspace, application, attempt, result, live)

    def _begin(
        self, user_id: str, workspace: CandidateWorkspace, application: ApplicationRecord, previous: AttemptView | None, url: str, host: str, live: bool
    ) -> AttemptView:
        attempt = previous or AttemptView(application_id=application.id, state=AttemptState.STOPPED, official_url=url, host=host)
        attempt = attempt.model_copy(update={"runs": attempt.runs + 1, "official_url": url, "updated_at": iso(self._ctx.clock.now())})
        self._attempts.save(user_id, application.id, attempt)
        if live:
            self._move(application, SubmissionStatus.SUBMITTING, translate("portal.timeline.started", {"host": host}))
            self._ctx.workspaces.save(user_id, workspace)
        return attempt

    def _execute(
        self,
        user_id: str,
        workspace: CandidateWorkspace,
        application: ApplicationRecord,
        settings: PortalSettings,
        opportunity: OpportunityDetail,
        attempt: AttemptView,
        live: bool,
    ) -> FlowResult:
        job = self._job(user_id, workspace, application, settings, opportunity, attempt, live)
        adapter = self._cfg.adapter_for(attempt.host)

        def mark_submitting() -> None:
            self._attempts.save(user_id, application.id, attempt.model_copy(update={"submit_clicked": True}))

        with self._ctx.throttle.slot(attempt.host), self._ctx.browser() as driver:
            deps = FlowDeps(
                driver=driver,
                config=self._cfg,
                adapter=adapter,
                accounts=self._ctx.accounts,
                fetch_verification=lambda: self._ctx.verifier.wait_for(user_id, attempt.host, adapter),
                before_submit=mark_submitting,
            )
            return PortalFlow(deps, job).run()

    def _job(
        self,
        user_id: str,
        workspace: CandidateWorkspace,
        application: ApplicationRecord,
        settings: PortalSettings,
        opportunity: OpportunityDetail,
        attempt: AttemptView,
        live: bool,
    ) -> FlowInput:
        rule = self._ctx.policy.rule_of(workspace, application)
        materials = application.materials
        return FlowInput(
            user_id=user_id,
            job_url=attempt.official_url,
            host=attempt.host,
            employer=opportunity.organization,
            mode=RunMode.LIVE if live else RunMode.READINESS,
            facts=profile_facts(workspace.profile),
            saved_answers=workspace.saved_answers,
            permissions=effective_permissions(settings, rule),
            cover_letter=materials.cover_letter if materials else "",
            cv=self._cv(workspace, application),
        )

    def _cv(self, workspace: CandidateWorkspace, application: ApplicationRecord) -> CvFile | None:
        if application.materials is None:
            return None
        cv = application.materials.cv
        documents = workspace.profile.active_documents()
        document = next((d for d in documents if d.id == cv.document_id), None) if cv.document_id else next((d for d in documents if d.name == cv.name), None)
        content = self._ctx.storage.get(document.current.key) if document else None
        return CvFile(document.current.file_name, content) if document and content else None

    def _finish(
        self, user_id: str, workspace: CandidateWorkspace, application: ApplicationRecord, attempt: AttemptView, result: FlowResult, live: bool
    ) -> RunReport:
        outcome = result.outcome
        stop = self._reported_stop(result, live)
        key = self._save_evidence(user_id, application.id, attempt.runs, result.screenshot)
        updated = attempt.model_copy(
            update={
                "state": STATE_OF_OUTCOME[outcome] if live else AttemptState.READINESS_ONLY,
                "stop": stop,
                "detail": result.detail,
                "pending": result.pending,
                "prepared": result.prepared,
                "submit_clicked": attempt.submit_clicked or result.submit_clicked,
                "final_url": result.final_url,
                "confirmation_text": result.confirmation_text,
                "evidence_key": key,
                "updated_at": iso(self._ctx.clock.now()),
            }
        )
        self._attempts.save(user_id, application.id, updated)
        if live and outcome in {FlowOutcome.CONFIRMED, FlowOutcome.UNCERTAIN}:
            return self._record_result(user_id, workspace, application, updated, outcome)
        return self._stop(user_id, workspace, application, stop or StopReason.LIVE_SWITCH_OFF, attempt.official_url, saved=True)

    @staticmethod
    def _reported_stop(result: FlowResult, live: bool) -> StopReason | None:
        if live or result.stop not in {None, StopReason.WALL_UNVERIFIED}:
            return result.stop
        return StopReason.LIVE_SWITCH_OFF

    def _record_result(
        self, user_id: str, workspace: CandidateWorkspace, application: ApplicationRecord, attempt: AttemptView, outcome: FlowOutcome
    ) -> RunReport:
        now = iso(self._ctx.clock.now())
        status = STATUS_OF_OUTCOME[outcome]
        if outcome is FlowOutcome.CONFIRMED:
            application.applied_at = application.applied_at or now
            text = translate("portal.evidence.confirmed", {"text": attempt.confirmation_text})
            application.evidence.append(Evidence(text=text, at=now, url=attempt.final_url, screenshot_key=attempt.evidence_key or None))
            note = translate("portal.timeline.confirmed", {"host": attempt.host})
        else:
            application.evidence.append(Evidence(text=translate("portal.evidence.uncertain"), at=now, url=attempt.final_url, screenshot_key=attempt.evidence_key or None))
            note = translate("portal.timeline.uncertain", {"host": attempt.host})
        self._move(application, status, note)
        self._ctx.workspaces.save(user_id, workspace)
        self._ctx.on_status(user_id, application)
        return RunReport(application.id, status)

    def _finish_uncertain(self, user_id: str, workspace: CandidateWorkspace, application: ApplicationRecord, attempt: AttemptView) -> RunReport:
        self._move(application, SubmissionStatus.OUTCOME_UNKNOWN, translate("portal.timeline.uncertain", {"host": attempt.host}))
        self._ctx.workspaces.save(user_id, workspace)
        self._ctx.on_status(user_id, application)
        return RunReport(application.id, application.submission_status)

    def _stop(
        self, user_id: str, workspace: CandidateWorkspace, application: ApplicationRecord, reason: StopReason, url: str = "", saved: bool = False
    ) -> RunReport:
        if not saved:
            self._remember_stop(user_id, application, reason, url)
        names = {"title": application.opportunity.title, "organization": application.opportunity.organization}
        text = translate(f"portal.stop.{reason.value}")
        self._move(application, SubmissionStatus.MANUAL_ACTION_REQUIRED, translate("portal.timeline.stopped", {"reason": text}))
        self._ctx.workspaces.save(user_id, workspace)
        self._ctx.notify(
            user_id,
            NotificationKind.AUTOMATION_ATTENTION,
            translate("portal.notifications.stoppedTitle"),
            translate("portal.notifications.stoppedBody", {**names, "reason": text}),
            (NotificationTarget.APPLICATION, application.id),
        )
        return RunReport(application.id, application.submission_status, stop=reason)

    def _remember_stop(self, user_id: str, application: ApplicationRecord, reason: StopReason, url: str) -> None:
        current = self._attempts.get(user_id, application.id)
        base = current or AttemptView(application_id=application.id, state=AttemptState.STOPPED, official_url=url, host=host_of(url) if url else "")
        self._attempts.save(user_id, application.id, base.model_copy(update={"state": AttemptState.STOPPED, "stop": reason, "updated_at": iso(self._ctx.clock.now())}))

    def _save_evidence(self, user_id: str, application_id: str, run: int, image: bytes | None) -> str:
        if not image:
            return ""
        key = f"{self._cfg.evidence_prefix}/{user_id}/{application_id}-{run}.png".lower()
        self._ctx.storage.put(key, image)
        return key

    def _move(self, application: ApplicationRecord, status: SubmissionStatus, text: str) -> None:
        now = iso(self._ctx.clock.now())
        application.submission_status = status
        application.updated_at = now
        application.timeline.append(TimelineEntry(at=now, actor=TimelineActor.SYSTEM, text=text, status=status))
