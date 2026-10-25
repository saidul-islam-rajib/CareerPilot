import asyncio
import os
from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta

from temporalio.client import (
    Client,
    Schedule,
    ScheduleActionStartWorkflow,
    ScheduleAlreadyRunningError,
    ScheduleIntervalSpec,
    ScheduleSpec,
)
from temporalio.worker import Worker

from careerpilot.bootstrap import build_container
from careerpilot.platform.config import WorkersConfig
from careerpilot.platform.telemetry import configure_telemetry
from careerpilot_workers.activities import DiscoveryActivities, SubmissionActivities
from careerpilot_workers.workflows import ActivityPlan, DiscoveryWorkflow, SubmissionWorkflow

WORKER_SERVICE = "careerpilot-workers"
SEQUENTIAL = 1


def activity_plan(config: WorkersConfig) -> ActivityPlan:
    return ActivityPlan(activity_timeout_seconds=config.activity_timeout_seconds, activity_max_attempts=config.activity_max_attempts)


def discovery_schedule(config: WorkersConfig) -> Schedule:
    return Schedule(
        action=ScheduleActionStartWorkflow(
            DiscoveryWorkflow.run, activity_plan(config), id=config.discovery_workflow_id, task_queue=config.discovery_task_queue
        ),
        spec=ScheduleSpec(intervals=[ScheduleIntervalSpec(every=timedelta(minutes=config.discovery_interval_minutes))]),
    )


def submission_schedule(config: WorkersConfig) -> Schedule:
    return Schedule(
        action=ScheduleActionStartWorkflow(
            SubmissionWorkflow.run, activity_plan(config), id=config.submission_workflow_id, task_queue=config.submission_task_queue
        ),
        spec=ScheduleSpec(intervals=[ScheduleIntervalSpec(every=timedelta(minutes=config.submission_interval_minutes))]),
    )


async def ensure_schedule(client: Client, schedule_id: str, schedule: Schedule) -> None:
    try:
        await client.create_schedule(schedule_id, schedule)
    except ScheduleAlreadyRunningError:
        return


async def serve() -> None:
    container = build_container()
    settings = container.settings
    configure_telemetry(settings.observability, WORKER_SERVICE)
    address = os.environ.get(settings.workers.temporal_address_env)
    if not address:
        raise RuntimeError(settings.workers.temporal_address_env)
    client = await Client.connect(address, namespace=settings.workers.namespace)
    workers = settings.workers
    await ensure_schedule(client, workers.discovery_schedule_id, discovery_schedule(workers))
    await ensure_schedule(client, workers.submission_schedule_id, submission_schedule(workers))
    discovery = DiscoveryActivities(container)
    submission = SubmissionActivities(container)
    with ThreadPoolExecutor() as executor:
        discovery_worker = Worker(
            client,
            task_queue=workers.discovery_task_queue,
            workflows=[DiscoveryWorkflow],
            activities=[discovery.due_sources, discovery.check_source],
            activity_executor=executor,
        )
        submission_worker = Worker(
            client,
            task_queue=workers.submission_task_queue,
            workflows=[SubmissionWorkflow],
            activities=[submission.due_applications, submission.submit_application, submission.confirm_sent],
            activity_executor=executor,
            max_concurrent_activities=SEQUENTIAL,
        )
        await asyncio.gather(discovery_worker.run(), submission_worker.run())


def main() -> None:
    asyncio.run(serve())


if __name__ == "__main__":
    main()
