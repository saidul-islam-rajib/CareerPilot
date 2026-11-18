from datetime import timedelta

import pytest

from careerpilot.administration.models import PlatformSettings
from careerpilot.automation.enums import SkipReason
from careerpilot.bootstrap import Container, ContainerOverrides, build_container
from careerpilot.candidate.models import SubmissionWindow
from careerpilot.candidate.services.preferences import NotificationChanges
from careerpilot.messaging.quiet import inside_window, parse_time
from careerpilot.platform.clock import FixedClock, SequentialIdGenerator, iso
from careerpilot.platform.email_delivery import InMemoryEmailSender
from careerpilot.platform.enums import (
    ApplicationFilter,
    ApprovalState,
    DevicePlatform,
    NotificationKind,
    NotificationTarget,
    SubmissionWindowKind,
)
from careerpilot.platform.files import InMemoryFileStorage
from careerpilot.platform.push import InMemoryPushSender
from careerpilot.platform.security import PasswordHasher
from careerpilot.repositories import Repositories, WorkspaceFactory
from careerpilot.testing import load_sample_data, sample_repositories, sample_settings
from tests.unit.conftest import DEMO_USER, TEST_SECRET, FakeHasher

TOKEN = "ExponentPushToken[demoDevice123]"
WHOLE_DAY = NotificationChanges(quiet_hours_enabled=True, quiet_start="00:00", quiet_end="23:59")
LEAD_HOURS = 10


@pytest.fixture
def pushes() -> InMemoryPushSender:
    return InMemoryPushSender()


@pytest.fixture
def built() -> list[Repositories]:
    return []


@pytest.fixture
def repositories(app: Container, built: list[Repositories]) -> Repositories:
    return built[0]


@pytest.fixture
def app(clock: FixedClock, pushes: InMemoryPushSender, built: list[Repositories]) -> Container:
    factory = sample_repositories(load_sample_data(clock.now()))

    def capture(hasher: PasswordHasher, empty: WorkspaceFactory, defaults: PlatformSettings) -> Repositories:
        built.append(factory(hasher, empty, defaults))
        return built[0]

    container = build_container(
        ContainerOverrides(
            settings=sample_settings(),
            repositories=capture,
            clock=clock,
            ids=SequentialIdGenerator(),
            hasher=FakeHasher(),
            token_secret=TEST_SECRET,
            file_storage=InMemoryFileStorage(),
            email_sender=InMemoryEmailSender(),
            push_sender=pushes,
        )
    )
    container.notifications.register_device(DEMO_USER, TOKEN, DevicePlatform.ANDROID)
    return container


def expire_soon(repositories: Repositories, clock: FixedClock) -> str:
    workspace = repositories.workspaces.get(DEMO_USER)
    approval = next(a for a in workspace.approvals if a.state is ApprovalState.PENDING)
    approval.expires_at = iso(clock.now() + timedelta(hours=LEAD_HOURS))
    repositories.workspaces.save(DEMO_USER, workspace)
    return approval.id


def test_overnight_window_wraps_midnight() -> None:
    start, end = parse_time("22:00"), parse_time("07:00")
    assert inside_window(parse_time("23:30"), start, end)
    assert inside_window(parse_time("06:59"), start, end)
    assert not inside_window(parse_time("07:00"), start, end)
    assert not inside_window(parse_time("12:00"), start, end)


def test_approval_reminder_is_sent_once_per_stage(app: Container, repositories: Repositories, clock: FixedClock) -> None:
    approval_id = expire_soon(repositories, clock)
    app.reminders.run_for(DEMO_USER)
    app.reminders.run_for(DEMO_USER)
    found = [n for n in app.notifications.recent(DEMO_USER) if n.kind is NotificationKind.APPROVAL_EXPIRING]
    assert [n.target_id for n in found].count(approval_id) == 1


def test_quiet_hours_hold_pushes_until_they_end(app: Container, pushes: InMemoryPushSender) -> None:
    app.preferences.update_notifications(DEMO_USER, WHOLE_DAY)
    app.notifications.notify(DEMO_USER, NotificationKind.SUPERVISOR_REPLY, "t", "b", (_target(), "x"))
    assert pushes.sent == []
    assert app.notifications.release_held(DEMO_USER) == 0
    app.preferences.update_notifications(DEMO_USER, NotificationChanges(quiet_hours_enabled=False))
    assert app.notifications.release_held(DEMO_USER) == 1
    assert len(pushes.sent) == 1


def test_urgent_override_sends_during_quiet_hours(app: Container, pushes: InMemoryPushSender) -> None:
    app.preferences.update_notifications(DEMO_USER, WHOLE_DAY)
    app.notifications.notify(DEMO_USER, NotificationKind.APPROVAL_EXPIRING, "t", "b", (_target(), "x"))
    assert pushes.sent == []
    app.preferences.update_notifications(DEMO_USER, NotificationChanges(urgent_overrides_quiet=True))
    app.notifications.notify(DEMO_USER, NotificationKind.APPROVAL_EXPIRING, "t", "b", (_target(), "x"))
    assert len(pushes.sent) == 1


def test_stale_profile_pauses_automation_and_asks_for_confirmation(app: Container, repositories: Repositories, clock: FixedClock) -> None:
    app.reminders.run_for(DEMO_USER)
    clock.advance(timedelta(days=app.settings.automation.default_freshness_days + 1))
    app.reminders.run_for(DEMO_USER)
    found = [n for n in app.notifications.recent(DEMO_USER) if n.kind is NotificationKind.PROFILE_CONFIRMATION]
    assert len(found) == 1
    assert SkipReason.PROFILE_STALE in app.automation.dry_run(DEMO_USER).holds
    app.reminders.confirm_profile(DEMO_USER)
    assert SkipReason.PROFILE_STALE not in app.automation.dry_run(DEMO_USER).holds
    assert repositories.workspaces.get(DEMO_USER).profile_confirmed_at == iso(clock.now())


def test_daily_report_is_part_of_the_digest(app: Container) -> None:
    app.preferences.update_submission_window(DEMO_USER, SubmissionWindow(kind=SubmissionWindowKind.AS_SOON_AS_READY))
    approval = app.approvals.prepare(DEMO_USER, "opp_intl_oslo")
    app.approvals.update_answer(DEMO_USER, approval.id, "q_relocate", "Yes")
    app.approvals.approve(DEMO_USER, approval.id)
    queued = next(a for a in app.applications.list(DEMO_USER, ApplicationFilter.ALL) if a.opportunity.id == "opp_intl_oslo")
    app.submissions.submit(DEMO_USER, queued.id)
    daily = next(section for section in app.digests.sections(DEMO_USER) if section.title_key == "digest.daily")
    assert any(f"/applications/{queued.id}" in line for line in daily.lines)


def _target() -> NotificationTarget:
    return NotificationTarget.PROFILE
