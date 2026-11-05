import asyncio
import os
from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta

from temporalio.client import Client
from temporalio.worker import Worker

from careerpilot.bootstrap import build_container
from careerpilot.platform.telemetry import configure_telemetry
from careerpilot_workers.activities import PortalActivities
from careerpilot_workers.workflows import PortalWorkflow

PORTAL_WORKER_SERVICE = "careerpilot-portal-worker"
SEQUENTIAL = 1


async def serve() -> None:
    container = build_container()
    settings = container.settings
    configure_telemetry(settings.observability, PORTAL_WORKER_SERVICE)
    address = os.environ.get(settings.workers.temporal_address_env)
    if not address:
        raise RuntimeError(settings.workers.temporal_address_env)
    client = await Client.connect(address, namespace=settings.workers.namespace)
    portal = PortalActivities(container)
    with ThreadPoolExecutor() as executor:
        worker = Worker(
            client,
            task_queue=settings.portals.task_queue,
            workflows=[PortalWorkflow],
            activities=[portal.due_portal_applications, portal.run_portal_application, portal.process_readiness],
            activity_executor=executor,
            max_concurrent_activities=SEQUENTIAL,
        )
        await worker.run()


def main() -> None:
    asyncio.run(serve())


if __name__ == "__main__":
    main()
