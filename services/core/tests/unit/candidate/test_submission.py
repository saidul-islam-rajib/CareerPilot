import smtplib
from datetime import timedelta
from typing import cast

import pytest

from careerpilot.bootstrap import Container, ContainerOverrides, build_container
from careerpilot.candidate.models import ApplicationRecord, SubmissionWindow
from careerpilot.platform.clock import FixedClock, SequentialIdGenerator
from careerpilot.platform.config import load_settings
from careerpilot.platform.email_delivery import (
    DeliveryError,
    DeliveryUncertainError,
    InMemoryEmailSender,
    OutgoingEmail,
    SmtpEmailSender,
    SmtpSettings,
)
from careerpilot.platform.enums import (
    ApplicationFilter,
    DeliveryMode,
    EmergencyStopScope,
    PauseDuration,
    SubmissionHold,
    SubmissionStatus,
    SubmissionWindowKind,
)
from careerpilot.platform.files import InMemoryFileStorage
from tests.unit.conftest import CLIENT, DEMO_USER, TEST_SECRET, FakeHasher

EMAIL_OPPORTUNITY = "opp_remote_frontend"
APPLIED_OPPORTUNITY = "opp_bd_dhaka"
PORTAL_OPPORTUNITY = "opp_intl_oslo"


@pytest.fixture
def sender() -> InMemoryEmailSender:
    return InMemoryEmailSender()


@pytest.fixture
def service(clock: FixedClock, sender: InMemoryEmailSender) -> Container:
    overrides = ContainerOverrides(
        settings=load_settings("local"),
        clock=clock,
        ids=SequentialIdGenerator(),
        hasher=FakeHasher(),
        token_secret=TEST_SECRET,
        file_storage=InMemoryFileStorage(),
        email_sender=sender,
    )
    container = build_container(overrides)
    container.preferences.update_submission_window(DEMO_USER, SubmissionWindow(kind=SubmissionWindowKind.AS_SOON_AS_READY))
    return container


def approve(container: Container, opportunity_id: str) -> str:
    approval = container.approvals.prepare(DEMO_USER, opportunity_id)
    container.approvals.approve(DEMO_USER, approval.id)
    record = next(a for a in container.applications.list(DEMO_USER, ApplicationFilter.ALL) if a.opportunity.id == opportunity_id)
    return record.id


def approve_fresh(container: Container, opportunity_id: str) -> str:
    approval = container.approvals.prepare(DEMO_USER, opportunity_id)
    container.approvals.approve(DEMO_USER, approval.id)
    return container.applications.list(DEMO_USER, ApplicationFilter.ALL)[0].id


def record(container: Container, application_id: str) -> ApplicationRecord:
    return container.applications.get(DEMO_USER, application_id)


def test_prepared_cover_letter_names_the_employer_role_and_cv(service: Container) -> None:
    approval_id = service.approvals.prepare(DEMO_USER, APPLIED_OPPORTUNITY).id
    detail = service.approvals.get(DEMO_USER, approval_id)
    letter = detail.materials.cover_letter
    assert "Dear Bay Digital Ltd hiring team" in letter
    assert "Software Engineer position" in letter
    assert "My key skills include React, TypeScript, Next.js, React Native, Accessibility." in letter
    assert "{" not in letter and "\n\n\n" not in letter
    assert detail.materials.cv.document_id == "doc_cv"


def test_email_application_is_sent_with_the_cv_and_recorded(service: Container, sender: InMemoryEmailSender) -> None:
    application_id = approve(service, EMAIL_OPPORTUNITY)
    assert service.submissions.submit(DEMO_USER, application_id).status is SubmissionStatus.SUBMITTED_AWAITING_CONFIRMATION
    email = sender.sent[0]
    assert (email.to, email.reply_to) == ("careers@northwind.example.com", "admin@sober.com")
    assert email.subject == "Application for Senior Frontend Engineer – Ayesha Rahman"
    assert email.sender_name == "Ayesha Rahman via CareerPilot"
    assert email.attachments[0].content.startswith(b"%PDF-")
    saved = record(service, application_id)
    assert saved.applied_at is not None
    assert [e.to for e in saved.emails] == ["careers@northwind.example.com"]
    assert saved.evidence[-1].text.startswith("Email accepted by the mail server")
    assert saved.timeline[-1].text.startswith("Email sent to careers@northwind.example.com")
    assert service.submissions.submit(DEMO_USER, application_id).status is SubmissionStatus.SUBMITTED_AWAITING_CONFIRMATION
    assert len(sender.sent) == 1


def test_sent_email_is_confirmed_after_the_bounce_window(service: Container, clock: FixedClock) -> None:
    application_id = approve(service, EMAIL_OPPORTUNITY)
    service.submissions.submit(DEMO_USER, application_id)
    assert service.submissions.confirm_sent() == 0
    clock.advance(timedelta(hours=service.settings.submission.bounce_window_hours))
    assert service.submissions.confirm_sent() >= 1
    saved = record(service, application_id)
    assert saved.submission_status is SubmissionStatus.CONFIRMED
    assert saved.evidence[-1].text == "No bounce received within 48 hours"


def test_portal_routes_need_the_user(service: Container, sender: InMemoryEmailSender) -> None:
    application_id = approve(service, PORTAL_OPPORTUNITY)
    assert service.submissions.submit(DEMO_USER, application_id).status is SubmissionStatus.MANUAL_ACTION_REQUIRED
    assert "only you can complete portal sign-in" in record(service, application_id).timeline[-1].text
    assert sender.sent == []


def test_transient_failures_retry_then_fail(service: Container, sender: InMemoryEmailSender) -> None:
    application_id = approve(service, EMAIL_OPPORTUNITY)
    attempts = service.settings.submission.max_attempts
    sender.failures.extend(DeliveryError("SMTPConnectError", retryable=True) for _ in range(attempts))
    for _ in range(attempts - 1):
        assert service.submissions.submit(DEMO_USER, application_id).status is SubmissionStatus.APPROVED_QUEUED
    assert service.submissions.submit(DEMO_USER, application_id).status is SubmissionStatus.FAILED
    assert record(service, application_id).timeline[-1].text == f"Sending failed after {attempts} attempts (SMTPConnectError)."
    assert sender.sent == []


def test_uncertain_delivery_is_never_resent(service: Container, sender: InMemoryEmailSender) -> None:
    application_id = approve(service, EMAIL_OPPORTUNITY)
    sender.failures.append(DeliveryUncertainError("SMTPServerDisconnected"))
    assert service.submissions.submit(DEMO_USER, application_id).status is SubmissionStatus.OUTCOME_UNKNOWN
    assert service.submissions.submit(DEMO_USER, application_id).status is SubmissionStatus.OUTCOME_UNKNOWN
    assert sender.sent == []


def test_checks_stop_bad_applications(service: Container, sender: InMemoryEmailSender) -> None:
    application_id = approve(service, EMAIL_OPPORTUNITY)
    workspace = service.profile._ctx.workspaces.get(DEMO_USER)
    application = next(a for a in workspace.applications if a.id == application_id)
    assert application.materials is not None
    application.materials.cover_letter = "Dear Northwind Labs team, I want the Senior Frontend Engineer role, as I told Meghna Tech."
    service.profile._ctx.workspaces.save(DEMO_USER, workspace)
    assert service.submissions.submit(DEMO_USER, application_id).status is SubmissionStatus.AWAITING_USER_INFORMATION
    assert record(service, application_id).timeline[-1].text == "Stopped before sending: The cover letter mentions another employer."
    assert sender.sent == []


def test_second_application_to_the_same_opening_is_stopped(service: Container, sender: InMemoryEmailSender) -> None:
    application_id = approve_fresh(service, APPLIED_OPPORTUNITY)
    assert service.submissions.submit(DEMO_USER, application_id).status is SubmissionStatus.FAILED
    assert record(service, application_id).timeline[-1].text == "Stopped before sending: You have already applied to this opening."
    assert sender.sent == []


def test_missing_cv_needs_the_user(service: Container) -> None:
    application_id = approve(service, EMAIL_OPPORTUNITY)
    service.profile.remove_document(DEMO_USER, "doc_cv")
    assert service.submissions.submit(DEMO_USER, application_id).status is SubmissionStatus.AWAITING_USER_INFORMATION


@pytest.mark.parametrize("hold", list(SubmissionHold))
def test_holds_keep_applications_queued(service: Container, sender: InMemoryEmailSender, clock: FixedClock, hold: SubmissionHold) -> None:
    application_id = approve(service, EMAIL_OPPORTUNITY)
    admin = service.admin_auth.authenticate(service.admin_auth.sign_in("admin@sober.com", "admin@sober.com", CLIENT.ip).access_token)
    if hold is SubmissionHold.EMERGENCY_STOP:
        service.admin_settings.start_emergency_stop(admin, EmergencyStopScope.ALL_USERS, "Portal incident", None)
    elif hold is SubmissionHold.PAUSED:
        service.preferences.pause(DEMO_USER, PauseDuration.DAYS, 7)
    elif hold is SubmissionHold.OUTSIDE_WINDOW:
        local_hour = (clock.now() + timedelta(hours=6)).hour
        start = f"{(local_hour + 2) % 24:02d}:00"
        end = f"{(local_hour + 3) % 24:02d}:00"
        service.preferences.update_submission_window(
            DEMO_USER, SubmissionWindow(kind=SubmissionWindowKind.DAILY_WINDOW, start=start, end=end)
        )
    else:
        service.admin_settings.update(admin, {"daily_application_cap": 1})
        workspace = service.profile._ctx.workspaces.get(DEMO_USER)
        workspace.applications[-1].applied_at = clock.now().isoformat()
        service.profile._ctx.workspaces.save(DEMO_USER, workspace)
    result = service.submissions.submit(DEMO_USER, application_id)
    assert (result.status, result.hold) == (SubmissionStatus.APPROVED_QUEUED, hold)
    assert sender.sent == []


def test_due_lists_queued_applications(service: Container) -> None:
    application_id = approve(service, EMAIL_OPPORTUNITY)
    assert any(q.application_id == application_id and q.user_id == DEMO_USER for q in service.submissions.due())


class FakeSmtp:
    def __init__(self, error: Exception | None = None, refused: dict[str, tuple[int, bytes]] | None = None) -> None:
        self.error = error
        self.refused = refused or {}
        self.messages: list[object] = []
        self.closed = False

    def send_message(self, message: object) -> dict[str, tuple[int, bytes]]:
        if self.error:
            raise self.error
        self.messages.append(message)
        return self.refused

    def quit(self) -> None:
        self.closed = True

    def close(self) -> None:
        self.closed = True


def smtp_sender(fake: FakeSmtp | Exception, host: str = "mailpit", mode: DeliveryMode = DeliveryMode.SANDBOX) -> SmtpEmailSender:
    settings = SmtpSettings(host=host, port=1025, timeout_seconds=1, mode=mode, sandbox_hosts=frozenset({"mailpit", "127.0.0.1"}))

    def connect(_host: str, _port: int, _timeout: float) -> smtplib.SMTP:
        if isinstance(fake, Exception):
            raise fake
        return cast("smtplib.SMTP", fake)

    return SmtpEmailSender(settings, connect)


EMAIL = OutgoingEmail(
    sender_name="A via CareerPilot", sender_address="apply@careerpilot.example", reply_to="a@b.co", to="hr@x.example", subject="S", body="B"
)


def test_smtp_sender_classifies_failures() -> None:
    assert smtp_sender(FakeSmtp()).send(EMAIL).message_id.endswith("@careerpilot.example>")
    with pytest.raises(DeliveryError) as refused_host:
        smtp_sender(FakeSmtp(), host="smtp.gmail.com").send(EMAIL)
    assert (refused_host.value.reason, refused_host.value.retryable) == ("sandbox_host_refused", False)
    with pytest.raises(DeliveryError) as offline:
        smtp_sender(ConnectionRefusedError()).send(EMAIL)
    assert offline.value.retryable is True
    with pytest.raises(DeliveryError) as rejected:
        smtp_sender(FakeSmtp(error=smtplib.SMTPRecipientsRefused({}))).send(EMAIL)
    assert rejected.value.retryable is False
    with pytest.raises(DeliveryUncertainError):
        smtp_sender(FakeSmtp(error=smtplib.SMTPServerDisconnected())).send(EMAIL)
    with pytest.raises(DeliveryError):
        smtp_sender(FakeSmtp(refused={"hr@x.example": (550, b"no")})).send(EMAIL)
    assert smtp_sender(FakeSmtp(), host="smtp.example.com", mode=DeliveryMode.LIVE).send(EMAIL).message_id
