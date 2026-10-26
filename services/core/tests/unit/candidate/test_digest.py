from datetime import timedelta

import pytest
from fastapi.testclient import TestClient

from careerpilot.api.user_app import create_user_app
from careerpilot.bootstrap import Container, ContainerOverrides, build_container
from careerpilot.candidate.models import SubmissionWindow
from careerpilot.platform.clock import FixedClock, SequentialIdGenerator
from careerpilot.platform.config import load_settings
from careerpilot.platform.email_delivery import DeliveryError, InMemoryEmailSender
from careerpilot.platform.enums import ApplicationFilter, SubmissionWindowKind
from careerpilot.platform.errors import DomainError
from careerpilot.platform.files import InMemoryFileStorage
from tests.unit.conftest import DEMO_USER, TEST_SECRET, FakeHasher


@pytest.fixture
def sender() -> InMemoryEmailSender:
    return InMemoryEmailSender()


@pytest.fixture
def app(clock: FixedClock, sender: InMemoryEmailSender) -> Container:
    overrides = ContainerOverrides(
        settings=load_settings("local"),
        clock=clock,
        ids=SequentialIdGenerator(),
        hasher=FakeHasher(),
        token_secret=TEST_SECRET,
        file_storage=InMemoryFileStorage(),
        email_sender=sender,
    )
    return build_container(overrides)


def test_digest_is_sent_once_a_day_after_the_chosen_time(app: Container, sender: InMemoryEmailSender, clock: FixedClock) -> None:
    assert DEMO_USER in app.digests.due_users()
    assert app.digests.send_due() >= 1
    email = next(e for e in sender.sent if e.to == "admin@sober.com")
    assert email.subject == "Your CareerPilot update for 20 Oct 2026"
    assert email.body.startswith("Hello Ayesha Rahman,\n\n")
    assert "Waiting for your approval (" in email.body
    assert "• Senior Frontend Engineer at Northwind Labs – approve by" in email.body
    assert "Open CareerPilot: http://localhost:3000" in email.body
    assert email.body.rstrip().endswith("Developed by Team Sober – https://team-sober.com/")
    assert DEMO_USER not in app.digests.due_users()
    clock.advance(timedelta(days=1))
    assert DEMO_USER in app.digests.due_users()


def test_digest_respects_preferences(app: Container) -> None:
    app.preferences.update_notifications(DEMO_USER, digest_enabled=None, digest_time="23:30")
    assert DEMO_USER not in app.digests.due_users()
    app.preferences.update_notifications(DEMO_USER, digest_enabled=False, digest_time="00:00")
    assert DEMO_USER not in app.digests.due_users()
    with pytest.raises(DomainError):
        app.preferences.update_notifications(DEMO_USER, digest_enabled=True, digest_time="25:00")


def test_sections_report_sent_and_blocked_applications(app: Container) -> None:
    app.preferences.update_submission_window(DEMO_USER, SubmissionWindow(kind=SubmissionWindowKind.AS_SOON_AS_READY))
    approval = app.approvals.prepare(DEMO_USER, "opp_intl_oslo")
    app.approvals.update_answer(DEMO_USER, approval.id, "q_relocate", "Yes")
    app.approvals.approve(DEMO_USER, approval.id)
    queued = next(a for a in app.applications.list(DEMO_USER, ApplicationFilter.ALL) if a.opportunity.id == "opp_intl_oslo")
    app.submissions.submit(DEMO_USER, queued.id)
    titles = {section.title_key: section for section in app.digests.sections(DEMO_USER)}
    assert {"digest.approvals", "digest.attention"} <= set(titles)
    assert any("Nordlys Systems" in line for line in titles["digest.attention"].lines)


def test_failed_delivery_is_not_reported_as_sent(app: Container, sender: InMemoryEmailSender) -> None:
    sender.failures.append(DeliveryError("SMTPConnectError", retryable=True))
    assert app.digests.send(DEMO_USER) is False


def test_notification_settings_endpoint(app: Container) -> None:
    client = TestClient(create_user_app(app))
    token = client.post("/v1/auth/sign-in", json={"email": "admin@sober.com", "password": "admin@sober.com"}).json()["accessToken"]
    headers = {"Authorization": f"Bearer {token}"}
    body = client.patch("/v1/settings/notifications", headers=headers, json={"digestEnabled": False, "digestTime": "07:30"}).json()
    assert body["notifications"] == {"digestEnabled": False, "digestTime": "07:30"}
    assert client.patch("/v1/settings/notifications", headers=headers, json={"digestTime": "7pm"}).status_code == 422
    assert client.get("/v1/settings", headers=headers).json()["notifications"]["digestEnabled"] is False


def test_new_users_see_the_default_digest_time(app: Container) -> None:
    client = TestClient(create_user_app(app))
    body = {
        "fullName": "Nadia Karim",
        "email": "nadia@example.com",
        "password": "Str0ng!Password",
        "consent": True,
        "consentDocuments": {"terms": "1", "privacy": "1"},
    }
    token = client.post("/v1/auth/register", json=body).json()["accessToken"]
    settings = client.get("/v1/settings", headers={"Authorization": f"Bearer {token}"}).json()
    assert settings["notifications"] == {"digestEnabled": True, "digestTime": "08:00"}


def test_public_config_offers_digest_time_presets(app: Container) -> None:
    notifications = TestClient(create_user_app(app)).get("/v1/config").json()["notifications"]
    assert notifications["defaultDigestTime"] == "08:00"
    assert [p["key"] for p in notifications["digestTimePresets"]] == ["morning", "lunchtime", "evening"]
