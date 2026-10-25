from datetime import UTC, datetime, timedelta

import pytest
from temporalio.client import ScheduleActionStartWorkflow
from temporalio.testing import ActivityEnvironment

from careerpilot.bootstrap import Container, ContainerOverrides, build_container
from careerpilot.platform.clock import FixedClock, SequentialIdGenerator
from careerpilot.platform.config import load_settings
from careerpilot.platform.email_delivery import InMemoryEmailSender
from careerpilot.platform.files import InMemoryFileStorage
from careerpilot_workers.activities import DigestActivities, DiscoveryActivities, SubmissionActivities
from careerpilot_workers.main import activity_plan, digest_schedule, discovery_schedule, submission_schedule
from careerpilot_workers.workflows import ActivityPlan, QueuedItem

TEST_SECRET = "unit-test-secret-that-is-long-enough-for-hmac"


class FakeHasher:
    def hash(self, password: str) -> str:
        return f"hashed:{password}"

    def verify(self, password_hash: str, password: str) -> bool:
        return password_hash == f"hashed:{password}"


@pytest.fixture
def container() -> Container:
    overrides = ContainerOverrides(
        file_storage=InMemoryFileStorage(),
        settings=load_settings("local"),
        clock=FixedClock(datetime(2026, 10, 20, 6, 0, tzinfo=UTC)),
        ids=SequentialIdGenerator(),
        hasher=FakeHasher(),
        token_secret=TEST_SECRET,
        email_sender=InMemoryEmailSender(),
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
    assert activity_plan(config) == ActivityPlan(config.activity_timeout_seconds, config.activity_max_attempts)


def test_submission_activities_process_the_queue(container: Container) -> None:
    activities = SubmissionActivities(container)
    queued = ActivityEnvironment().run(activities.due_applications)
    assert queued and all(isinstance(item, QueuedItem) for item in queued)
    report = ActivityEnvironment().run(activities.submit_application, queued[0])
    assert report.application_id == queued[0].application_id
    assert report.status in {"approved_queued", "manual_action_required", "submitted_awaiting_confirmation", "awaiting_user_information"}
    assert ActivityEnvironment().run(activities.confirm_sent) >= 0


def test_submission_runs_on_its_own_schedule_and_queue() -> None:
    config = load_settings("local").workers
    schedule = submission_schedule(config)
    assert schedule.spec.intervals[0].every == timedelta(minutes=config.submission_interval_minutes)
    action = schedule.action
    assert isinstance(action, ScheduleActionStartWorkflow)
    assert action.task_queue == config.submission_task_queue != config.discovery_task_queue


def test_digests_run_on_the_email_queue(container: Container) -> None:
    config = load_settings("local").workers
    action = digest_schedule(config).action
    assert isinstance(action, ScheduleActionStartWorkflow)
    assert action.task_queue == config.submission_task_queue
    assert ActivityEnvironment().run(DigestActivities(container).send_digests) >= 0
