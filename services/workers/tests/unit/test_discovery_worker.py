from datetime import UTC, datetime, timedelta

import pytest
from temporalio.client import ScheduleActionStartWorkflow
from temporalio.testing import ActivityEnvironment

from careerpilot.bootstrap import Container, ContainerOverrides, build_container
from careerpilot.platform.clock import FixedClock, SequentialIdGenerator
from careerpilot.platform.config import load_settings
from careerpilot_workers.activities import DiscoveryActivities
from careerpilot_workers.main import discovery_plan, discovery_schedule
from careerpilot_workers.workflows import DiscoveryPlan

TEST_SECRET = "unit-test-secret-that-is-long-enough-for-hmac"


class FakeHasher:
    def hash(self, password: str) -> str:
        return f"hashed:{password}"

    def verify(self, password_hash: str, password: str) -> bool:
        return password_hash == f"hashed:{password}"


@pytest.fixture
def container() -> Container:
    overrides = ContainerOverrides(
        settings=load_settings("local"),
        clock=FixedClock(datetime(2026, 10, 20, 6, 0, tzinfo=UTC)),
        ids=SequentialIdGenerator(),
        hasher=FakeHasher(),
        token_secret=TEST_SECRET,
    )
    return build_container(overrides)


def test_due_sources_are_enabled_and_configured(container: Container) -> None:
    due = ActivityEnvironment().run(DiscoveryActivities(container).due_sources)
    assert sorted(due) == ["src_company_pages", "src_remote_board"]


def test_check_source_reports_outcome(container: Container) -> None:
    result = ActivityEnvironment().run(DiscoveryActivities(container).check_source, "src_remote_board")
    assert (result.source_id, result.outcome, result.new_listings, result.error) == ("src_remote_board", "succeeded", 0, None)


def test_check_source_reports_unconfigured_sources_without_raising(container: Container) -> None:
    result = ActivityEnvironment().run(DiscoveryActivities(container).check_source, "src_gov_notices")
    assert (result.outcome, result.error) == (None, "source_not_configured")


def test_schedule_runs_discovery_on_configured_interval() -> None:
    config = load_settings("local").workers
    schedule = discovery_schedule(config)
    assert schedule.spec.intervals[0].every == timedelta(minutes=config.discovery_interval_minutes)
    action = schedule.action
    assert isinstance(action, ScheduleActionStartWorkflow)
    assert action.task_queue == config.discovery_task_queue
    assert discovery_plan(config) == DiscoveryPlan(config.activity_timeout_seconds, config.activity_max_attempts)
