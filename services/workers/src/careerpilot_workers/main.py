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
from careerpilot_workers.activities import DiscoveryActivities
from careerpilot_workers.workflows import DiscoveryPlan, DiscoveryWorkflow

WORKER_SERVICE = "careerpilot-workers"


def discovery_plan(config: WorkersConfig) -> DiscoveryPlan:
    return DiscoveryPlan(activity_timeout_seconds=config.activity_timeout_seconds, activity_max_attempts=config.activity_max_attempts)


def discovery_schedule(config: WorkersConfig) -> Schedule:
    return Schedule(
        action=ScheduleActionStartWorkflow(
            DiscoveryWorkflow.run, discovery_plan(config), id=config.discovery_workflow_id, task_queue=config.discovery_task_queue
        ),
        spec=ScheduleSpec(intervals=[ScheduleIntervalSpec(every=timedelta(minutes=config.discovery_interval_minutes))]),
    )


async def ensure_schedule(client: Client, config: WorkersConfig) -> None:
    try:
        await client.create_schedule(config.discovery_schedule_id, discovery_schedule(config))
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
    await ensure_schedule(client, settings.workers)
    activities = DiscoveryActivities(container)
    with ThreadPoolExecutor() as executor:
        worker = Worker(
            client,
            task_queue=settings.workers.discovery_task_queue,
            workflows=[DiscoveryWorkflow],
            activities=[activities.due_sources, activities.check_source],
            activity_executor=executor,
        )
        await worker.run()


def main() -> None:
    asyncio.run(serve())


if __name__ == "__main__":
    main()
