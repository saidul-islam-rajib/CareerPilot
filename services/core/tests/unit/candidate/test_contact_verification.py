import re
from datetime import timedelta

import pytest
from fastapi.testclient import TestClient

from careerpilot.api.user_app import create_user_app
from careerpilot.bootstrap import Container, ContainerOverrides, build_container
from careerpilot.platform.clock import FixedClock, SequentialIdGenerator
from careerpilot.platform.email_delivery import DeliveryError, InMemoryEmailSender
from careerpilot.platform.enums import ContactKind
from careerpilot.platform.errors import DomainError, ErrorCode
from careerpilot.platform.files import InMemoryFileStorage
from careerpilot.testing import load_sample_data, sample_repositories, sample_settings
from tests.unit.conftest import DEMO_USER, TEST_SECRET, FakeHasher

PERSONAL = "c_email_personal"
CODE_LINE = re.compile(r"^(\d{6})$", re.MULTILINE)


@pytest.fixture
def sender() -> InMemoryEmailSender:
    return InMemoryEmailSender()


@pytest.fixture
def app(clock: FixedClock, sender: InMemoryEmailSender) -> Container:
    overrides = ContainerOverrides(
        settings=sample_settings(),
        repositories=sample_repositories(load_sample_data(clock.now())),
        clock=clock,
        ids=SequentialIdGenerator(),
        hasher=FakeHasher(),
        token_secret=TEST_SECRET,
        file_storage=InMemoryFileStorage(),
        email_sender=sender,
    )
    return build_container(overrides)


def last_code(sender: InMemoryEmailSender) -> str:
    match = CODE_LINE.search(sender.sent[-1].body)
    assert match is not None
    return match.group(1)


def contact(app: Container, contact_id: str) -> bool:
    return next(c.verified for c in app.profile.get(DEMO_USER).contacts if c.id == contact_id)


def failure(app_call: object) -> tuple[ErrorCode, str | None]:
    with pytest.raises(DomainError) as caught:
        assert callable(app_call)
        app_call()
    return caught.value.code, caught.value.detail


def test_email_code_verifies_the_contact(app: Container, sender: InMemoryEmailSender) -> None:
    challenge = app.verification.send(DEMO_USER, PERSONAL)
    email = sender.sent[-1]
    assert (email.to, email.subject) == ("ayesha.personal@example.com", "Your CareerPilot verification code")
    assert "The code expires in 10 minutes." in email.body
    assert email.body.rstrip().endswith("Developed by Team Sober – https://team-sober.com/")
    assert challenge.destination == "a•••@example.com"
    assert challenge.resend_after_seconds == 60
    code = last_code(sender)
    assert code not in challenge.model_dump_json()
    assert failure(lambda: app.verification.confirm(DEMO_USER, PERSONAL, "000000")) == (ErrorCode.VALIDATION, "code_invalid")
    app.verification.confirm(DEMO_USER, PERSONAL, code)
    assert contact(app, PERSONAL) is True
    assert failure(lambda: app.verification.send(DEMO_USER, PERSONAL)) == (ErrorCode.CONFLICT, "already_verified")


def test_codes_expire_and_follow_the_address(app: Container, sender: InMemoryEmailSender, clock: FixedClock) -> None:
    app.verification.send(DEMO_USER, PERSONAL)
    code = last_code(sender)
    app.profile.update_contact(DEMO_USER, PERSONAL, "ayesha.new@example.com", None)
    assert failure(lambda: app.verification.confirm(DEMO_USER, PERSONAL, code)) == (ErrorCode.VALIDATION, "code_expired")
    clock.advance(timedelta(minutes=11))
    app.verification.send(DEMO_USER, PERSONAL)
    assert sender.sent[-1].to == "ayesha.new@example.com"
    fresh = last_code(sender)
    clock.advance(timedelta(minutes=11))
    assert failure(lambda: app.verification.confirm(DEMO_USER, PERSONAL, fresh)) == (ErrorCode.VALIDATION, "code_expired")


def test_phones_wait_for_an_sms_provider_and_a_failed_email_frees_a_new_code(app: Container, sender: InMemoryEmailSender) -> None:
    profile = app.profile.add_contact(DEMO_USER, ContactKind.PHONE, "+8801700000001", "Office")
    phone = profile.contacts[-1].id
    assert failure(lambda: app.verification.send(DEMO_USER, phone)) == (ErrorCode.SERVICE_UNAVAILABLE, "sms_unavailable")
    sender.failures.append(DeliveryError("SMTPConnectError", retryable=True))
    app.verification.send(DEMO_USER, PERSONAL)
    assert sender.sent == []
    app.verification.send(DEMO_USER, PERSONAL)
    assert sender.sent[-1].to == "ayesha.personal@example.com"


def test_verification_endpoints(app: Container, sender: InMemoryEmailSender) -> None:
    client = TestClient(create_user_app(app))
    token = client.post("/v1/auth/sign-in", json={"email": "admin@sober.com", "password": "admin@sober.com"}).json()["accessToken"]
    headers = {"Authorization": f"Bearer {token}"}
    challenge = client.post(f"/v1/profile/contacts/{PERSONAL}/verification", headers=headers).json()
    assert set(challenge) == {"destination", "expiresAt", "resendAfterSeconds"}
    again = client.post(f"/v1/profile/contacts/{PERSONAL}/verification", headers=headers)
    assert (again.status_code, again.json()["detail"]) == (429, "resend_cooldown")
    wrong = client.post(f"/v1/profile/contacts/{PERSONAL}/verification/confirm", headers=headers, json={"code": "000000"})
    assert (wrong.status_code, wrong.json()["detail"]) == (422, "code_invalid")
    body = client.post(f"/v1/profile/contacts/{PERSONAL}/verification/confirm", headers=headers, json={"code": last_code(sender)}).json()
    assert next(c for c in body["contacts"] if c["id"] == PERSONAL)["verified"] is True
    assert client.get("/v1/config").json()["verification"] == {
        "codeLength": 6,
        "codeTtlSeconds": 600,
        "resendCooldownSeconds": 60,
        "smsEnabled": False,
    }
