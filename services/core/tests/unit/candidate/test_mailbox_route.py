from urllib.parse import parse_qs, urlsplit

import pytest

from careerpilot.bootstrap import Container, ContainerOverrides, build_container
from careerpilot.candidate.models import SubmissionWindow
from careerpilot.integrations.fake_google import FakeGoogleGateway
from careerpilot.platform.clock import FixedClock, SequentialIdGenerator
from careerpilot.platform.email_delivery import InMemoryEmailSender
from careerpilot.platform.enums import SubmissionStatus, SubmissionWindowKind
from careerpilot.platform.files import InMemoryFileStorage
from careerpilot.testing import load_sample_data, sample_repositories, sample_settings
from tests.unit.candidate.test_submission import EMAIL_OPPORTUNITY, approve
from tests.unit.conftest import DEMO_USER, TEST_SECRET, FakeHasher

CLIENT_ID_ENV = "CAREERPILOT_GOOGLE_CLIENT_ID"
CLIENT_SECRET_ENV = "CAREERPILOT_GOOGLE_CLIENT_SECRET"
MAILBOX = "ayesha@gmail.com"


def build(clock: FixedClock, sender: InMemoryEmailSender, gateway: FakeGoogleGateway, live: bool) -> Container:
    container = build_container(
        ContainerOverrides(
            settings=sample_settings(),
            repositories=sample_repositories(load_sample_data(clock.now())),
            clock=clock,
            ids=SequentialIdGenerator(),
            hasher=FakeHasher(),
            token_secret=TEST_SECRET,
            file_storage=InMemoryFileStorage(),
            email_sender=sender,
            google_gateway=gateway,
            real_applications=live,
        )
    )
    container.preferences.update_submission_window(DEMO_USER, SubmissionWindow(kind=SubmissionWindowKind.AS_SOON_AS_READY))
    return container


def connect(container: Container, email_route: bool) -> None:
    google = container.integrations.google
    url = google.authorize_url(DEMO_USER, email_route).url
    google.complete(parse_qs(urlsplit(url).query)["state"][0], "code", None)


@pytest.fixture(autouse=True)
def credentials(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv(CLIENT_ID_ENV, "client-id.apps.example.test")
    monkeypatch.setenv(CLIENT_SECRET_ENV, "client-secret")


def gateway_with(scopes: list[str]) -> FakeGoogleGateway:
    return FakeGoogleGateway(email=MAILBOX, scopes=scopes)


def test_the_send_scope_is_requested_only_for_the_email_route(clock: FixedClock, sender: InMemoryEmailSender) -> None:
    container = build(clock, sender, gateway_with([]), live=True)
    config = container.settings.integrations.google
    plain = container.integrations.google.authorize_url(DEMO_USER).url
    asked = container.integrations.google.authorize_url(DEMO_USER, True).url
    assert config.send_scope not in parse_qs(urlsplit(plain).query)["scope"][0].split()
    assert config.send_scope in parse_qs(urlsplit(asked).query)["scope"][0].split()


def test_the_live_switch_sends_from_the_users_own_mailbox(clock: FixedClock, sender: InMemoryEmailSender) -> None:
    probe = build(clock, sender, gateway_with([]), live=True)
    scopes = [*probe.settings.integrations.google.scopes, probe.settings.integrations.google.send_scope]
    gateway = gateway_with(scopes)
    container = build(clock, sender, gateway, live=True)
    connect(container, True)
    application_id = approve(container, EMAIL_OPPORTUNITY)
    result = container.submissions.submit(DEMO_USER, application_id)
    assert result.status is SubmissionStatus.SUBMITTED_AWAITING_CONFIRMATION
    assert sender.sent == []
    assert len(gateway.sent) == 1
    assert f"<{MAILBOX}>".encode() in gateway.sent[0]
    assert container.integrations.google.status(DEMO_USER).send_access


def test_without_the_send_scope_the_application_goes_to_manual_action(clock: FixedClock, sender: InMemoryEmailSender) -> None:
    gateway = gateway_with(list(sample_settings().integrations.google.scopes))
    container = build(clock, sender, gateway, live=True)
    connect(container, False)
    application_id = approve(container, EMAIL_OPPORTUNITY)
    result = container.submissions.submit(DEMO_USER, application_id)
    assert result.status is SubmissionStatus.MANUAL_ACTION_REQUIRED
    assert gateway.sent == [] and sender.sent == []
    assert not container.integrations.google.status(DEMO_USER).send_access


def test_with_no_connection_the_application_goes_to_manual_action(clock: FixedClock, sender: InMemoryEmailSender) -> None:
    container = build(clock, sender, gateway_with([]), live=True)
    application_id = approve(container, EMAIL_OPPORTUNITY)
    assert container.submissions.submit(DEMO_USER, application_id).status is SubmissionStatus.MANUAL_ACTION_REQUIRED


def test_with_the_switch_off_mail_goes_to_the_sandbox_as_before(clock: FixedClock, sender: InMemoryEmailSender) -> None:
    gateway = gateway_with([])
    container = build(clock, sender, gateway, live=False)
    application_id = approve(container, EMAIL_OPPORTUNITY)
    assert container.submissions.submit(DEMO_USER, application_id).status is SubmissionStatus.SUBMITTED_AWAITING_CONFIRMATION
    assert len(sender.sent) == 1 and gateway.sent == []
