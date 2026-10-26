from datetime import timedelta

import pytest
from fastapi.testclient import TestClient

from careerpilot.api.user_app import create_user_app
from careerpilot.bootstrap import Container
from careerpilot.candidate.services.applications import TaskDraft
from careerpilot.platform.clock import FixedClock, iso
from careerpilot.platform.enums import OutcomeStatus, TaskKind, TaskStatus, TimelineActor
from careerpilot.platform.errors import DomainError, ErrorCode
from tests.unit.conftest import DEMO_USER

KITE = "app_kite"


def draft(title: str = "First interview", due_in: timedelta | None = timedelta(days=2), clock: FixedClock | None = None) -> TaskDraft:
    due_at = iso(clock.now() + due_in) if clock and due_in is not None else None
    return TaskDraft(kind=TaskKind.INTERVIEW, title=title, due_at=due_at, location=" https://meet.example/abc ", notes="Bring portfolio")


def failure(action: object) -> tuple[ErrorCode, str | None]:
    with pytest.raises(DomainError) as caught:
        assert callable(action)
        action()
    return caught.value.code, caught.value.detail


def test_outcome_changes_are_recorded_by_the_user(container: Container, clock: FixedClock) -> None:
    record = container.applications.update_outcome(DEMO_USER, KITE, OutcomeStatus.REJECTED, "  Position filled internally ")
    assert record.outcome_status is OutcomeStatus.REJECTED
    assert record.last_contact_at == iso(clock.now())
    last = record.timeline[-1]
    assert (last.actor, last.text) == (TimelineActor.USER, "Outcome set to Rejected: Position filled internally")
    clock.advance(timedelta(hours=1))
    withdrawn = container.applications.update_outcome(DEMO_USER, KITE, OutcomeStatus.WITHDRAWN, None)
    assert withdrawn.last_contact_at == record.last_contact_at
    assert withdrawn.timeline[-1].text == "Outcome set to Withdrawn"
    assert failure(lambda: container.applications.update_outcome(DEMO_USER, KITE, OutcomeStatus.CLOSED, "x" * 501)) == (
        ErrorCode.VALIDATION,
        "note",
    )
    assert (
        failure(lambda: container.applications.update_outcome(DEMO_USER, "app_missing", OutcomeStatus.CLOSED, None))[0]
        is ErrorCode.NOT_FOUND
    )


def test_tasks_are_added_edited_and_completed_without_changing_the_status(container: Container, clock: FixedClock) -> None:
    before = container.applications.get(DEMO_USER, KITE)
    record = container.applications.add_task(DEMO_USER, KITE, draft(clock=clock))
    task = record.tasks[-1]
    assert (task.kind, task.title, task.location, task.status) == (
        TaskKind.INTERVIEW,
        "First interview",
        "https://meet.example/abc",
        TaskStatus.OPEN,
    )
    assert record.timeline[-1].text == "Added Interview: First interview"
    edited = container.applications.edit_task(DEMO_USER, KITE, task.id, draft("Second interview", None))
    assert (edited.tasks[-1].title, edited.tasks[-1].due_at) == ("Second interview", None)
    done = container.applications.set_task_status(DEMO_USER, KITE, task.id, TaskStatus.DONE)
    assert done.tasks[-1].status is TaskStatus.DONE
    assert (done.submission_status, done.outcome_status) == (before.submission_status, before.outcome_status)
    assert done.timeline[-1].text == "Completed Interview: Second interview"


def test_task_input_is_validated(container: Container) -> None:
    def add(task: TaskDraft) -> object:
        return lambda: container.applications.add_task(DEMO_USER, KITE, task)

    assert failure(add(TaskDraft(TaskKind.OTHER, "   ", None, "", ""))) == (ErrorCode.VALIDATION, "title")
    assert failure(add(TaskDraft(TaskKind.OTHER, "x" * 121, None, "", ""))) == (ErrorCode.VALIDATION, "title")
    assert failure(add(TaskDraft(TaskKind.OTHER, "Call", "2026-10-21T10:00:00", "", ""))) == (ErrorCode.VALIDATION, "due_at")
    assert failure(add(TaskDraft(TaskKind.OTHER, "Call", "tomorrow", "", ""))) == (ErrorCode.VALIDATION, "due_at")
    assert (
        failure(lambda: container.applications.set_task_status(DEMO_USER, KITE, "task_missing", TaskStatus.DONE))[0] is ErrorCode.NOT_FOUND
    )


def test_dashboard_lists_open_tasks_coming_up_soonest_first(container: Container, clock: FixedClock) -> None:
    container.applications.add_task(DEMO_USER, KITE, draft("Later", timedelta(days=5), clock))
    container.applications.add_task(DEMO_USER, "app_bay", draft("Sooner", timedelta(hours=3), clock))
    container.applications.add_task(DEMO_USER, KITE, draft("Too far", timedelta(days=30), clock))
    no_date = container.applications.add_task(DEMO_USER, KITE, draft("Someday", None)).tasks[-1]
    done = container.applications.add_task(DEMO_USER, KITE, draft("Finished", timedelta(days=1), clock)).tasks[-1]
    container.applications.set_task_status(DEMO_USER, KITE, done.id, TaskStatus.DONE)
    upcoming = container.dashboard.get(DEMO_USER).upcoming
    mine = {"Later", "Sooner", "Too far", "Someday", "Finished"}
    assert [(u.application_id, u.task.title) for u in upcoming if u.task.title in mine] == [("app_bay", "Sooner"), (KITE, "Later")]
    assert [u.task.due_at for u in upcoming] == sorted(u.task.due_at or "" for u in upcoming)
    assert no_date.id not in {u.task.id for u in upcoming}
    assert upcoming[0].organization


def test_follow_up_endpoints(container: Container) -> None:
    client = TestClient(create_user_app(container))
    token = client.post("/v1/auth/sign-in", json={"email": "admin@sober.com", "password": "admin@sober.com"}).json()["accessToken"]
    headers = {"Authorization": f"Bearer {token}"}
    outcome = client.put(f"/v1/applications/{KITE}/outcome", headers=headers, json={"outcome": "interview", "note": "Call on Monday"})
    assert outcome.json()["outcomeStatus"] == "interview"
    added = client.post(
        f"/v1/applications/{KITE}/tasks",
        headers=headers,
        json={"kind": "interview", "title": "Video call", "dueAt": "2026-10-22T04:00:00Z"},
    )
    task = added.json()["tasks"][-1]
    assert (task["title"], task["dueAt"], task["status"]) == ("Video call", "2026-10-22T04:00:00.000Z", "open")
    edited = client.put(
        f"/v1/applications/{KITE}/tasks/{task['id']}", headers=headers, json={"kind": "interview", "title": "Panel interview"}
    )
    assert edited.json()["tasks"][-1]["title"] == "Panel interview"
    status = client.put(f"/v1/applications/{KITE}/tasks/{task['id']}/status", headers=headers, json={"status": "dismissed"})
    assert status.json()["tasks"][-1]["status"] == "dismissed"
    assert client.put(f"/v1/applications/{KITE}/outcome", headers=headers, json={"outcome": "ghosted"}).status_code == 422
    tracking = client.get("/v1/config").json()["tracking"]
    assert (tracking["followUpAfterDays"], tracking["upcomingDays"]) == (14, 7)
