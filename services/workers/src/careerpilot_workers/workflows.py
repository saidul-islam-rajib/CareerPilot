from dataclasses import dataclass
from datetime import timedelta

from temporalio import workflow
from temporalio.common import RetryPolicy

DUE_SOURCES = "due_sources"
CHECK_SOURCE = "check_source"


@dataclass(frozen=True)
class ActivityPlan:
    activity_timeout_seconds: int
    activity_max_attempts: int


@dataclass(frozen=True)
class SourceCheckResult:
    source_id: str
    outcome: str | None
    new_listings: int
    error: str | None = None


@workflow.defn(name="DiscoveryWorkflow")
class DiscoveryWorkflow:
    @workflow.run
    async def run(self, plan: ActivityPlan) -> list[SourceCheckResult]:
        timeout = timedelta(seconds=plan.activity_timeout_seconds)
        retry = RetryPolicy(maximum_attempts=plan.activity_max_attempts)
        sources: list[str] = await workflow.execute_activity(
            DUE_SOURCES, start_to_close_timeout=timeout, retry_policy=retry, result_type=list[str]
        )
        results: list[SourceCheckResult] = []
        for source_id in sources:
            result: SourceCheckResult = await workflow.execute_activity(
                CHECK_SOURCE, source_id, start_to_close_timeout=timeout, retry_policy=retry, result_type=SourceCheckResult
            )
            results.append(result)
        return results


DUE_APPLICATIONS = "due_applications"
SUBMIT_APPLICATION = "submit_application"
CONFIRM_SENT = "confirm_sent"


@dataclass(frozen=True)
class QueuedItem:
    user_id: str
    application_id: str


@dataclass(frozen=True)
class SubmissionReport:
    application_id: str
    status: str
    hold: str | None


@dataclass(frozen=True)
class SubmissionRun:
    reports: list[SubmissionReport]
    confirmed: int


@workflow.defn(name="SubmissionWorkflow")
class SubmissionWorkflow:
    @workflow.run
    async def run(self, plan: ActivityPlan) -> SubmissionRun:
        timeout = timedelta(seconds=plan.activity_timeout_seconds)
        once = RetryPolicy(maximum_attempts=1)
        queued: list[QueuedItem] = await workflow.execute_activity(
            DUE_APPLICATIONS,
            start_to_close_timeout=timeout,
            retry_policy=RetryPolicy(maximum_attempts=plan.activity_max_attempts),
            result_type=list[QueuedItem],
        )
        reports: list[SubmissionReport] = []
        for item in queued:
            report: SubmissionReport = await workflow.execute_activity(
                SUBMIT_APPLICATION, item, start_to_close_timeout=timeout, retry_policy=once, result_type=SubmissionReport
            )
            reports.append(report)
        confirmed: int = await workflow.execute_activity(CONFIRM_SENT, start_to_close_timeout=timeout, retry_policy=once, result_type=int)
        return SubmissionRun(reports=reports, confirmed=confirmed)


SEND_DIGESTS = "send_digests"


@workflow.defn(name="DigestWorkflow")
class DigestWorkflow:
    @workflow.run
    async def run(self, plan: ActivityPlan) -> int:
        timeout = timedelta(seconds=plan.activity_timeout_seconds)
        return await workflow.execute_activity(
            SEND_DIGESTS, start_to_close_timeout=timeout, retry_policy=RetryPolicy(maximum_attempts=1), result_type=int
        )


RUN_PRIVACY_JOBS = "run_privacy_jobs"


@workflow.defn(name="PrivacyWorkflow")
class PrivacyWorkflow:
    @workflow.run
    async def run(self, plan: ActivityPlan) -> int:
        timeout = timedelta(seconds=plan.activity_timeout_seconds)
        return await workflow.execute_activity(
            RUN_PRIVACY_JOBS, start_to_close_timeout=timeout, retry_policy=RetryPolicy(maximum_attempts=1), result_type=int
        )


SYNC_INBOXES = "sync_inboxes"


@workflow.defn(name="InboxSyncWorkflow")
class InboxSyncWorkflow:
    @workflow.run
    async def run(self, plan: ActivityPlan) -> int:
        timeout = timedelta(seconds=plan.activity_timeout_seconds)
        return await workflow.execute_activity(
            SYNC_INBOXES, start_to_close_timeout=timeout, retry_policy=RetryPolicy(maximum_attempts=1), result_type=int
        )


DUE_PORTAL_APPLICATIONS = "due_portal_applications"
RUN_PORTAL_APPLICATION = "run_portal_application"
PROCESS_READINESS = "process_readiness"


@dataclass(frozen=True)
class PortalReport:
    application_id: str
    status: str
    stop: str | None


@dataclass(frozen=True)
class PortalRun:
    reports: list[PortalReport]
    readiness: int


@workflow.defn(name="PortalWorkflow")
class PortalWorkflow:
    @workflow.run
    async def run(self, plan: ActivityPlan) -> PortalRun:
        timeout = timedelta(seconds=plan.activity_timeout_seconds)
        once = RetryPolicy(maximum_attempts=1)
        queued: list[QueuedItem] = await workflow.execute_activity(
            DUE_PORTAL_APPLICATIONS, start_to_close_timeout=timeout, retry_policy=once, result_type=list[QueuedItem]
        )
        reports: list[PortalReport] = []
        for item in queued:
            report: PortalReport = await workflow.execute_activity(
                RUN_PORTAL_APPLICATION, item, start_to_close_timeout=timeout, retry_policy=once, result_type=PortalReport
            )
            reports.append(report)
        readiness: int = await workflow.execute_activity(
            PROCESS_READINESS, start_to_close_timeout=timeout, retry_policy=once, result_type=int
        )
        return PortalRun(reports=reports, readiness=readiness)
