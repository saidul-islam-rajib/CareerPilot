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
