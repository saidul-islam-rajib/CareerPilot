from dataclasses import dataclass

from careerpilot.candidate.ports import WorkspaceRepository
from careerpilot.platform.clock import Clock, IdGenerator, iso
from careerpilot.platform.errors import not_found
from careerpilot.portal.accounts import PortalAccounts
from careerpilot.portal.config import PortalsConfig
from careerpilot.portal.driver import BrowserSession
from careerpilot.portal.enums import FieldStatus, FlowOutcome, HostPolicy, ReadinessState, RecordKind, RunMode, StopReason, Verdict
from careerpilot.portal.facts import profile_facts
from careerpilot.portal.flow import CvFile, FlowDeps, FlowInput, FlowResult, PortalFlow
from careerpilot.portal.hosts import HostPolicies, host_of
from careerpilot.portal.models import Permissions, ReadinessReport
from careerpilot.portal.ports import PortalRecordRepository
from careerpilot.portal.store import RecordStore
from careerpilot.portal.throttle import HostThrottle

REPORT_PREFIX = "prr"
MAPPED_STATUSES = frozenset({FieldStatus.MAPPED, FieldStatus.CORRECTED})
PLACEHOLDER_CV = "cv.pdf"


@dataclass(frozen=True)
class ReadinessContext:
    config: PortalsConfig
    clock: Clock
    ids: IdGenerator
    records: PortalRecordRepository
    workspaces: WorkspaceRepository
    accounts: PortalAccounts
    hosts: HostPolicies
    throttle: HostThrottle
    browser: BrowserSession


def distinct(reasons: list[StopReason | None]) -> list[StopReason]:
    return list(dict.fromkeys(r for r in reasons if r is not None))


class ReadinessChecker:
    def __init__(self, context: ReadinessContext) -> None:
        self._ctx = context
        self._store = RecordStore(context.records, RecordKind.READINESS, ReadinessReport)

    def request(self, user_id: str, url: str) -> ReadinessReport:
        host = host_of(url)
        report = ReadinessReport(
            id=self._ctx.ids.next(REPORT_PREFIX),
            url=url,
            host=host,
            state=ReadinessState.PENDING,
            requested_at=iso(self._ctx.clock.now()),
            requested_by=user_id,
        )
        return self._store.save(user_id, report.id, report)

    def get(self, user_id: str, report_id: str) -> ReadinessReport:
        found = self._store.get(user_id, report_id)
        if found is None:
            raise not_found(RecordKind.READINESS.value)
        return found

    def recent(self, user_id: str) -> list[ReadinessReport]:
        return sorted(self._store.all(user_id), key=lambda r: r.requested_at, reverse=True)[: self._ctx.config.limits.max_list_items]

    def process_pending(self) -> int:
        pending = [(u, r) for u, r in self._store.everyone() if r.state is ReadinessState.PENDING][: self._ctx.config.readiness_batch]
        for user_id, report in pending:
            self._store.save(user_id, report.id, self.check(user_id, report))
        return len(pending)

    def check(self, user_id: str | None, report: ReadinessReport) -> ReadinessReport:
        policy = self._ctx.hosts.observe(report.host).policy
        base = report.model_copy(update={"host_policy": policy, "mode": RunMode.READINESS})
        if policy is HostPolicy.BLOCKED:
            return self._done(base, FlowResult(stop=StopReason.HOST_BLOCKED))
        try:
            result = self._run(user_id, base)
        except Exception as error:
            return base.model_copy(update={"state": ReadinessState.FAILED, "error": type(error).__name__, "finished_at": iso(self._ctx.clock.now())})
        return self._done(base, result)

    def _run(self, user_id: str | None, report: ReadinessReport) -> FlowResult:
        job = self._job(user_id, report)
        adapter = self._ctx.config.adapter_for(report.host)
        with self._ctx.throttle.slot(report.host), self._ctx.browser() as driver:
            deps = FlowDeps(driver=driver, config=self._ctx.config, adapter=adapter, accounts=self._ctx.accounts, fetch_verification=lambda: None)
            return PortalFlow(deps, job).run()

    def _job(self, user_id: str | None, report: ReadinessReport) -> FlowInput:
        workspace = self._ctx.workspaces.get(user_id) if user_id else None
        profile = workspace.profile if workspace else None
        has_cv = bool(profile and profile.active_documents())
        return FlowInput(
            user_id=user_id or "",
            job_url=report.url,
            host=report.host,
            employer="",
            mode=RunMode.READINESS,
            facts=profile_facts(profile) if profile else {},
            saved_answers=workspace.saved_answers if workspace else [],
            permissions=Permissions(),
            cv=CvFile(PLACEHOLDER_CV, b"") if has_cv else None,
        )

    def _done(self, report: ReadinessReport, result: FlowResult) -> ReadinessReport:
        stops = [p.stop for p in result.plans]
        reasons = distinct([result.stop, *stops])
        if report.host_policy is HostPolicy.REVIEW:
            reasons = distinct([StopReason.HOST_REVIEW, *reasons])
        ready = result.outcome is FlowOutcome.READY and not reasons
        return report.model_copy(
            update={
                "state": ReadinessState.DONE,
                "finished_at": iso(self._ctx.clock.now()),
                "wall": result.wall,
                "captcha_seen": result.captcha_seen,
                "page_title": result.title,
                "final_url": result.final_url,
                "fields": result.plans,
                "mapped": sum(1 for p in result.plans if p.status in MAPPED_STATUSES),
                "unknown": sum(1 for p in result.plans if p.stop is not None),
                "verdict": Verdict.CAN_AUTO_APPLY if ready else Verdict.WILL_STOP,
                "reasons": reasons,
            }
        )
