from datetime import timedelta

import pytest
from fastapi.testclient import TestClient

from careerpilot.api.user_app import create_user_app
from careerpilot.bootstrap import Container
from careerpilot.candidate.ports import Account
from careerpilot.candidate.services.auth import Registration
from careerpilot.platform.clock import FixedClock
from careerpilot.platform.email_delivery import DeliveryError, InMemoryEmailSender
from careerpilot.platform.enums import AccountLinkPurpose, UserAccountStatus
from careerpilot.platform.errors import DomainError, ErrorCode
from tests.unit.conftest import CLIENT, DEMO_USER, STRONG_PASSWORD, emailed_link, link_token, register_and_activate

DEMO_EMAIL = "admin@sober.com"
DEMO_PASSWORD = "admin@sober.com"
NEW_EMAIL = "new.person@example.com"
NEW_PASSWORD = "N3w!Password99"
REGISTRATION = Registration(full_name="New Person", email=NEW_EMAIL, consent=True, terms_version="1.0", privacy_version="1.0")


def failure(action: object) -> tuple[ErrorCode, str | None]:
    with pytest.raises(DomainError) as caught:
        assert callable(action)
        action()
    return caught.value.code, caught.value.detail


def stored(container: Container, email: str) -> Account:
    account = container.auth._ctx.accounts.find_by_email(email)
    assert account is not None
    return account


def test_registration_stores_a_registered_account_and_emails_a_link(container: Container, outbox: InMemoryEmailSender) -> None:
    assert container.auth.register(REGISTRATION, CLIENT) is None
    account = stored(container, NEW_EMAIL)
    assert account.status is UserAccountStatus.REGISTERED
    assert account.password_hash == ""
    assert (account.consent_terms_version, account.consent_ip, account.consent_device) == ("1.0", CLIENT.ip, CLIENT.device)
    assert account.consent_at is not None
    email = outbox.sent[-1]
    assert (email.to, email.subject) == (NEW_EMAIL, "Finish creating your CareerPilot account")
    assert emailed_link(outbox).startswith("http://localhost:3000/set-password?token=")
    assert "60 minutes" in email.body
    assert "Developed by Team Sober" in email.body


def test_registration_never_reveals_or_changes_an_existing_account(container: Container, outbox: InMemoryEmailSender) -> None:
    before = stored(container, DEMO_EMAIL)
    assert container.auth.register(Registration("Someone Else", DEMO_EMAIL, True, "1.0", "1.0"), CLIENT) is None
    assert outbox.sent == []
    assert stored(container, DEMO_EMAIL) == before


def test_registering_again_replaces_the_link_and_updates_the_name(
    container: Container, outbox: InMemoryEmailSender, clock: FixedClock
) -> None:
    container.auth.register(REGISTRATION, CLIENT)
    first = link_token(outbox)
    clock.advance(timedelta(seconds=container.settings.account_links.resend_cooldown_seconds))
    container.auth.register(Registration("Renamed Person", NEW_EMAIL, True, "1.0", "1.0"), CLIENT)
    second = link_token(outbox)
    assert first != second
    assert failure(lambda: container.auth.inspect_link(first, CLIENT)) == (ErrorCode.VALIDATION, "link_invalid")
    assert container.auth.inspect_link(second, CLIENT).full_name == "Renamed Person"


def test_registered_accounts_cannot_sign_in(container: Container) -> None:
    container.auth.register(REGISTRATION, CLIENT)
    assert failure(lambda: container.auth.sign_in(NEW_EMAIL, "", CLIENT))[0] is ErrorCode.INVALID_CREDENTIALS
    assert stored(container, NEW_EMAIL).user.id not in container.auth._ctx.accounts.active_ids()


def test_inspecting_shows_who_the_link_is_for_without_using_it_up(container: Container, outbox: InMemoryEmailSender) -> None:
    container.auth.register(REGISTRATION, CLIENT)
    token = link_token(outbox)
    details = container.auth.inspect_link(token, CLIENT)
    assert (details.purpose, details.full_name, details.email) == (AccountLinkPurpose.SETUP, "New Person", NEW_EMAIL)
    assert container.auth.inspect_link(token, CLIENT) == details


def test_weak_passwords_leave_the_link_usable(container: Container, outbox: InMemoryEmailSender) -> None:
    container.auth.register(REGISTRATION, CLIENT)
    token = link_token(outbox)
    assert failure(lambda: container.auth.complete_link(token, "weak", CLIENT)) == (ErrorCode.VALIDATION, "password")
    assert container.auth.complete_link(token, STRONG_PASSWORD, CLIENT).user.email == NEW_EMAIL


def test_completing_activates_starts_the_profile_signs_in_and_uses_up_the_link(container: Container, outbox: InMemoryEmailSender) -> None:
    container.auth.register(REGISTRATION, CLIENT)
    token = link_token(outbox)
    session = container.auth.complete_link(token, STRONG_PASSWORD, CLIENT)
    assert container.auth.authenticate(session.access_token).email == NEW_EMAIL
    assert stored(container, NEW_EMAIL).status is UserAccountStatus.ACTIVE
    assert container.profile.get(session.user.id).full_name == "New Person"
    assert container.preferences.sign_in_activity(session.user.id)[0].success
    assert container.auth.sign_in(NEW_EMAIL, STRONG_PASSWORD, CLIENT).user.id == session.user.id
    assert failure(lambda: container.auth.complete_link(token, STRONG_PASSWORD, CLIENT)) == (ErrorCode.VALIDATION, "link_expired")


def test_links_expire(container: Container, outbox: InMemoryEmailSender, clock: FixedClock) -> None:
    container.auth.register(REGISTRATION, CLIENT)
    clock.advance(timedelta(minutes=container.settings.account_links.ttl_minutes, seconds=1))
    assert failure(lambda: container.auth.inspect_link(link_token(outbox), CLIENT)) == (ErrorCode.VALIDATION, "link_expired")


@pytest.mark.parametrize("token", ["", "garbage", "usr_unknown.secret", f"{DEMO_USER}.", f"{DEMO_USER}.not-the-secret"])
def test_malformed_and_unknown_links_are_invalid(container: Container, token: str) -> None:
    code, detail = failure(lambda: container.auth.inspect_link(token, CLIENT))
    assert code is ErrorCode.VALIDATION
    assert detail in {"link_invalid", "link_expired"}


def test_reset_links_go_to_active_and_registered_accounts_only(container: Container, outbox: InMemoryEmailSender) -> None:
    container.auth.request_password_reset("nobody@example.com", CLIENT)
    assert outbox.sent == []
    container.auth.request_password_reset(DEMO_EMAIL, CLIENT)
    assert (outbox.sent[-1].to, outbox.sent[-1].subject) == (DEMO_EMAIL, "Reset your CareerPilot password")
    assert container.auth.inspect_link(link_token(outbox), CLIENT).purpose is AccountLinkPurpose.RESET
    container.auth.register(REGISTRATION, CLIENT)
    assert outbox.sent[-1].subject == "Finish creating your CareerPilot account"


def test_reset_signs_out_older_sessions(container: Container, outbox: InMemoryEmailSender, clock: FixedClock) -> None:
    old = container.auth.sign_in(DEMO_EMAIL, DEMO_PASSWORD, CLIENT).access_token
    clock.advance(timedelta(seconds=5))
    container.auth.request_password_reset(DEMO_EMAIL, CLIENT)
    fresh = container.auth.complete_link(link_token(outbox), NEW_PASSWORD, CLIENT).access_token
    assert failure(lambda: container.auth.authenticate(old))[0] is ErrorCode.UNAUTHORIZED
    assert container.auth.authenticate(fresh).id == DEMO_USER
    assert failure(lambda: container.auth.sign_in(DEMO_EMAIL, DEMO_PASSWORD, CLIENT))[0] is ErrorCode.INVALID_CREDENTIALS
    assert container.auth.sign_in(DEMO_EMAIL, NEW_PASSWORD, CLIENT).user.id == DEMO_USER


def test_a_used_link_lets_the_next_link_go_out_at_once(container: Container, outbox: InMemoryEmailSender) -> None:
    register_and_activate(container, outbox, REGISTRATION)
    container.auth.request_password_reset(NEW_EMAIL, CLIENT)
    assert [e.subject for e in outbox.sent] == ["Finish creating your CareerPilot account", "Reset your CareerPilot password"]


def test_resend_cooldown_never_reveals_an_account(container: Container, outbox: InMemoryEmailSender) -> None:
    container.auth.request_password_reset(DEMO_EMAIL, CLIENT)
    container.auth.request_password_reset(DEMO_EMAIL, CLIENT)
    assert len(outbox.sent) == 1


def test_failed_delivery_withdraws_the_link(container: Container, outbox: InMemoryEmailSender) -> None:
    outbox.failures.append(DeliveryError("SMTPConnectError", retryable=True))
    assert failure(lambda: container.auth.register(REGISTRATION, CLIENT)) == (ErrorCode.SERVICE_UNAVAILABLE, "delivery_failed")
    container.auth.register(REGISTRATION, CLIENT)
    assert container.auth.inspect_link(link_token(outbox), CLIENT).email == NEW_EMAIL


def test_registration_and_links_over_http(container: Container, outbox: InMemoryEmailSender) -> None:
    client = TestClient(create_user_app(container))
    body = {"fullName": "New Person", "email": NEW_EMAIL, "consent": True, "consentDocuments": {"terms": "1.0", "privacy": "1.0"}}
    assert client.post("/v1/auth/register", json=body).status_code == 204
    token = link_token(outbox)
    secret = token.partition(".")[2]
    inspected = client.post("/v1/auth/account-links/inspect", json={"token": token})
    assert inspected.json() == {"purpose": "setup", "fullName": "New Person", "email": NEW_EMAIL}
    completed = client.post("/v1/auth/account-links/complete", json={"token": token, "password": STRONG_PASSWORD})
    assert completed.status_code == 200
    assert secret not in completed.text
    assert client.get("/v1/dashboard", headers={"Authorization": f"Bearer {completed.json()['accessToken']}"}).status_code == 200
    reused = client.post("/v1/auth/account-links/complete", json={"token": token, "password": STRONG_PASSWORD})
    assert (reused.status_code, reused.json()["code"], reused.json()["detail"]) == (422, "validation", "link_expired")
    assert client.post("/v1/auth/password-reset", json={"email": "nobody@example.com"}).status_code == 204
    assert client.get("/v1/config").json()["accountLinks"] == {"ttlMinutes": 60, "resendCooldownSeconds": 60}


def test_activated_registration_helper_returns_a_session(container: Container, outbox: InMemoryEmailSender) -> None:
    session = register_and_activate(container, outbox, REGISTRATION)
    assert session.user.full_name == "New Person"
