from dataclasses import dataclass
from datetime import timedelta

from temporalio import workflow
from temporalio.common import RetryPolicy

DUE_SOURCES = "due_sources"
CHECK_SOURCE = "check_source"


@dataclass(frozen=True)
class DiscoveryPlan:
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
    async def run(self, plan: DiscoveryPlan) -> list[SourceCheckResult]:
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
