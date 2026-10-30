from datetime import UTC, datetime

import pytest

from careerpilot.bootstrap import Container
from careerpilot.candidate.models import FollowUpTask
from careerpilot.integrations.classifier import RuleBasedClassifier
from careerpilot.integrations.dates import MomentFinder
from careerpilot.integrations.fake_google import FakeGoogleGateway
from careerpilot.platform.config import load_settings
from careerpilot.platform.enums import ReplyKind, TaskStatus
from tests.unit.conftest import DEMO_USER, NOW
from tests.unit.integrations.conftest import connect

BAY_TASK = "task_bay_interview"


def change_task(container: Container, **changes: object) -> None:
    workspaces = container.applications._ctx.workspaces  # pyright: ignore[reportPrivateUsage]
    workspace = workspaces.get(DEMO_USER)
    bay = next(a for a in workspace.applications if a.id == "app_bay")
    bay.tasks = [t.model_copy(update=changes) if t.id == BAY_TASK else t for t in bay.tasks]
    workspaces.save(DEMO_USER, workspace)


def bay_task(container: Container) -> FollowUpTask:
    workspace = container.applications._ctx.workspaces.get(DEMO_USER)  # pyright: ignore[reportPrivateUsage]
    return next(t for a in workspace.applications if a.id == "app_bay" for t in a.tasks if t.id == BAY_TASK)


def test_an_interview_task_becomes_one_event_and_repeat_syncs_change_nothing(google: Container, gateway: FakeGoogleGateway) -> None:
    connect(google)
    google.integrations.sync.sync_user(DEMO_USER)
    google.integrations.sync.sync_user(DEMO_USER)
    assert gateway.event_saves == 1
    [event] = gateway.events.values()
    assert event.title.startswith("First interview with the engineering manager")
    assert event.time_zone == "Asia/Dhaka"
    assert event.start == datetime(2026, 10, 22, 10, 0, tzinfo=UTC)
    assert (event.end - event.start).total_seconds() == 3600
    assert event.location == "Bay Digital office, Gulshan 2, Dhaka"


def test_a_changed_task_updates_the_same_event(google: Container, gateway: FakeGoogleGateway) -> None:
    connect(google)
    google.integrations.sync.sync_user(DEMO_USER)
    [first_id] = gateway.events
    change_task(google, due_at="2026-10-23T09:00:00.000Z")
    google.integrations.sync.sync_user(DEMO_USER)
    assert list(gateway.events) == [first_id]
    assert gateway.event_saves == 2
    assert gateway.events[first_id].start == datetime(2026, 10, 23, 9, 0, tzinfo=UTC)


def test_a_dismissed_task_cancels_the_event_and_reopening_brings_it_back_without_a_duplicate(
    google: Container, gateway: FakeGoogleGateway
) -> None:
    connect(google)
    google.integrations.sync.sync_user(DEMO_USER)
    [event_id] = gateway.events
    change_task(google, status=TaskStatus.DISMISSED)
    google.integrations.sync.sync_user(DEMO_USER)
    assert gateway.events == {}
    google.integrations.sync.sync_user(DEMO_USER)
    change_task(google, status=TaskStatus.OPEN)
    google.integrations.sync.sync_user(DEMO_USER)
    assert list(gateway.events) == [event_id]


def test_tasks_without_a_date_or_that_are_done_are_not_sent(google: Container, gateway: FakeGoogleGateway) -> None:
    change_task(google, due_at=None)
    connect(google)
    google.integrations.sync.sync_user(DEMO_USER)
    assert gateway.event_saves == 0
    change_task(google, due_at="2026-10-22T10:00:00.000Z", status=TaskStatus.DONE)
    google.integrations.sync.sync_user(DEMO_USER)
    assert gateway.event_saves == 0


def test_without_calendar_access_no_events_are_written(google: Container, gateway: FakeGoogleGateway) -> None:
    gateway.scopes = [s for s in gateway.scopes if "calendar" not in s]
    connect(google)
    assert google.integrations.sync.sync_user(DEMO_USER).events == 0
    assert gateway.event_saves == 0


def test_event_ids_are_stable_and_valid_for_google(google: Container) -> None:
    calendar = google.integrations.sync._ctx.calendar  # pyright: ignore[reportPrivateUsage]
    first = calendar.event_id(DEMO_USER, BAY_TASK)
    assert first == calendar.event_id(DEMO_USER, BAY_TASK) != calendar.event_id(DEMO_USER, "other")
    assert 5 <= len(first) <= 100 and set(first) <= set("abcdefghijklmnopqrstuv0123456789")


@pytest.mark.parametrize(
    ("subject", "body", "kind"),
    [
        ("Interview invitation", "", ReplyKind.INTERVIEW_INVITE),
        ("Update", "We regret to inform you that we will not be moving forward.", ReplyKind.REJECTION),
        ("Update", "Unfortunately we picked others. We will not be moving forward, though your interview was great.", ReplyKind.REJECTION),
        ("Your offer", "We are pleased to offer you the role. Offer letter attached.", ReplyKind.OFFER),
        ("Next step", "Please complete the online assessment on HackerRank.", ReplyKind.ASSESSMENT),
        ("Thanks", "Thank you for applying. We have received your application.", ReplyKind.OTHER_REPLY),
        ("Hello", "Nothing special here.", ReplyKind.OTHER_REPLY),
    ],
)
def test_the_rule_classifier_finds_the_kind(subject: str, body: str, kind: ReplyKind) -> None:
    result = RuleBasedClassifier(load_settings("local").integrations.classification).classify(subject, body)
    assert result.kind is kind
    assert 0 < result.confidence <= 1


def test_unclassified_mail_has_low_confidence() -> None:
    config = load_settings("local").integrations.classification
    result = RuleBasedClassifier(config).classify("Hello", "Nothing special here.")
    assert result.confidence == config.unclassified_confidence < config.apply_min_confidence


@pytest.mark.parametrize(
    ("text", "expected"),
    [
        ("Please join us on 25 October 2026 at 14:30.", datetime(2026, 10, 25, 8, 30, tzinfo=UTC)),
        ("Interview: November 3rd, 2026, 10:30 AM", datetime(2026, 11, 3, 4, 30, tzinfo=UTC)),
        ("We would meet 2026-11-04 at 3 PM sharp", datetime(2026, 11, 4, 9, 0, tzinfo=UTC)),
        ("Join at 10:00 on 12 Nov 2026", datetime(2026, 11, 12, 4, 0, tzinfo=UTC)),
        ("Sometime next week", None),
        ("On 25 October 2026 but no time given", None),
        ("It was on 1 January 2020 at 09:00", None),
    ],
)
def test_interview_times_are_read_in_the_users_time_zone(text: str, expected: datetime | None) -> None:
    finder = MomentFinder(load_settings("local").integrations.dates)
    found = finder.find(text, "Asia/Dhaka", NOW)
    assert (found.astimezone(UTC) if found else None) == expected


def test_an_unknown_time_zone_finds_nothing() -> None:
    finder = MomentFinder(load_settings("local").integrations.dates)
    assert finder.find("25 October 2026 at 14:30", "Nowhere/Land", NOW) is None
