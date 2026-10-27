from urllib.parse import parse_qs, urlsplit

import pytest
from fastapi.testclient import TestClient

from careerpilot.api.admin_app import create_admin_app
from careerpilot.bootstrap import Container
from careerpilot.platform.email_delivery import InMemoryEmailSender
from careerpilot.platform.enums import AdminRole
from careerpilot.platform.errors import DomainError, ErrorCode
from tests.unit.conftest import CLIENT, STRONG_PASSWORD, emailed_link, link_token

OWNER_ENV = "CAREERPILOT_OWNER_EMAIL"
OWNER_EMAIL = "owner@example.com"
SAMPLE_ADMIN = "admin@sober.com"
UNKNOWN_EMAIL = "nobody@example.com"
WEAK_PASSWORD = "short"
BASE = "/admin/v1/auth"


@pytest.fixture
def owner_env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv(OWNER_ENV, f"  {OWNER_EMAIL.upper()} ")


def failure(action: object) -> tuple[ErrorCode, str | None]:
    assert callable(action)
    with pytest.raises(DomainError) as raised:
        action()
    return raised.value.code, raised.value.detail


@pytest.mark.usefixtures("owner_env")
def test_the_owner_gets_a_pending_super_admin_and_one_link(empty_container: Container, outbox: InMemoryEmailSender) -> None:
    assert empty_container.invite_owner() is True
    email = outbox.sent[-1]
    assert (email.to, email.subject, email.sender_address) == (OWNER_EMAIL, "Choose your CareerPilot admin password", "info@team-sober.com")
    link = urlsplit(emailed_link(outbox))
    assert f"{link.scheme}://{link.netloc}{link.path}" == "http://localhost:3001/set-password"
    assert "expires in 5 minutes" in email.body
    assert failure(lambda: empty_container.admin_auth.sign_in(OWNER_EMAIL, "", CLIENT.ip)) == (ErrorCode.INVALID_CREDENTIALS, None)
    assert empty_container.invite_owner() is False
    assert len(outbox.sent) == 1


def test_no_owner_is_invited_without_an_owner_email(
    empty_container: Container, outbox: InMemoryEmailSender, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.delenv(OWNER_ENV, raising=False)
    assert empty_container.invite_owner() is False
    assert outbox.sent == []


@pytest.mark.usefixtures("owner_env")
def test_no_owner_is_invited_once_an_admin_exists(container: Container, outbox: InMemoryEmailSender) -> None:
    assert container.invite_owner() is False
    assert outbox.sent == []


@pytest.mark.usefixtures("owner_env")
def test_the_owner_link_sets_the_password_and_signs_in(empty_container: Container, outbox: InMemoryEmailSender) -> None:
    empty_container.invite_owner()
    token = link_token(outbox)
    details = empty_container.admin_auth.inspect_link(token, CLIENT.ip)
    assert (details.email, details.full_name) == (OWNER_EMAIL, "Owner")
    assert failure(lambda: empty_container.admin_auth.complete_link(token, WEAK_PASSWORD, CLIENT.ip)) == (ErrorCode.VALIDATION, "password")
    session = empty_container.admin_auth.complete_link(token, STRONG_PASSWORD, CLIENT.ip)
    assert (session.admin.email, session.admin.role) == (OWNER_EMAIL, AdminRole.SUPER_ADMIN)
    assert empty_container.admin_auth.authenticate(session.access_token).summary.email == OWNER_EMAIL
    assert empty_container.admin_auth.sign_in(OWNER_EMAIL, STRONG_PASSWORD, CLIENT.ip).admin.email == OWNER_EMAIL
    assert failure(lambda: empty_container.admin_auth.complete_link(token, STRONG_PASSWORD, CLIENT.ip))[1] in {
        "link_invalid",
        "link_expired",
    }


def test_password_links_go_only_to_admins(container: Container, outbox: InMemoryEmailSender) -> None:
    container.admin_auth.request_password_link(UNKNOWN_EMAIL, CLIENT.ip)
    assert outbox.sent == []
    container.admin_auth.request_password_link(SAMPLE_ADMIN, CLIENT.ip)
    assert outbox.sent[-1].to == SAMPLE_ADMIN
    container.admin_auth.complete_link(link_token(outbox), STRONG_PASSWORD, CLIENT.ip)
    assert container.admin_auth.sign_in(SAMPLE_ADMIN, STRONG_PASSWORD, CLIENT.ip).admin.email == SAMPLE_ADMIN


def test_malformed_and_unknown_links_fail(container: Container) -> None:
    assert failure(lambda: container.admin_auth.inspect_link("not-a-token", CLIENT.ip)) == (ErrorCode.VALIDATION, "link_invalid")
    unknown = "adm_unknown." + "x" * 43
    assert failure(lambda: container.admin_auth.inspect_link(unknown, CLIENT.ip)) == (ErrorCode.VALIDATION, "link_invalid")


def test_admin_link_endpoints(container: Container, outbox: InMemoryEmailSender) -> None:
    client = TestClient(create_admin_app(container))
    assert client.post(f"{BASE}/password-link", json={"email": UNKNOWN_EMAIL}).status_code == 204
    assert client.post(f"{BASE}/password-link", json={"email": SAMPLE_ADMIN}).status_code == 204
    token = parse_qs(urlsplit(emailed_link(outbox)).query)["token"][0]
    inspected = client.post(f"{BASE}/account-links/inspect", json={"token": token})
    assert inspected.json() == {"fullName": inspected.json()["fullName"], "email": SAMPLE_ADMIN}
    completed = client.post(f"{BASE}/account-links/complete", json={"token": token, "password": STRONG_PASSWORD})
    assert completed.status_code == 200
    assert completed.json()["admin"]["email"] == SAMPLE_ADMIN
    assert token not in str(completed.json())
    assert client.post(f"{BASE}/account-links/inspect", json={"token": "bad"}).json()["detail"] == "link_invalid"
