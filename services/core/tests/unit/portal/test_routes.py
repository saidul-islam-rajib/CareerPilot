from typing import Any

import pytest
from fastapi.testclient import TestClient

from careerpilot.api.admin_app import create_admin_app
from careerpilot.api.user_app import create_user_app
from careerpilot.bootstrap import Container
from careerpilot.portal.enums import HostPolicy, ReadinessState
from careerpilot.portal.models import HostInput
from tests.unit.portal.conftest import ACCOUNT_EMAIL, HOST

PASSWORD = "admin@sober.com"
BASE = "/v1/portal"
ADMIN_BASE = "/admin/v1/portals"
ENABLE: dict[str, Any] = {
    "acknowledged": True,
    "allowAccountCreation": True,
    "accountEmail": ACCOUNT_EMAIL,
    "acceptTerms": True,
    "acceptPrivacy": True,
    "allowEmailVerification": False,
}


@pytest.fixture
def client(container: Container) -> TestClient:
    app = TestClient(create_user_app(container))
    token = app.post("/v1/auth/sign-in", json={"email": "admin@sober.com", "password": PASSWORD}).json()["accessToken"]
    app.headers["Authorization"] = f"Bearer {token}"
    return app


@pytest.fixture
def admin(container: Container) -> TestClient:
    app = TestClient(create_admin_app(container))
    token = app.post("/admin/v1/auth/sign-in", json={"email": PASSWORD, "password": PASSWORD}).json()["accessToken"]
    app.headers["Authorization"] = f"Bearer {token}"
    return app


def test_autopilot_is_off_until_the_user_turns_it_on(client: TestClient) -> None:
    state = client.get(f"{BASE}/autopilot").json()
    assert state["settings"]["enabled"] is False
    assert state["summary"]["live"] is False
    assert "legal_declarations" in state["summary"]["userOnlySteps"]
    enabled = client.put(f"{BASE}/autopilot", json=ENABLE).json()
    assert enabled["settings"]["enabled"] is True
    assert enabled["settings"]["permissions"]["accountEmail"] == ACCOUNT_EMAIL
    assert client.delete(f"{BASE}/autopilot").json()["settings"]["enabled"] is False


def test_unacknowledged_summary_is_refused(client: TestClient) -> None:
    response = client.put(f"{BASE}/autopilot", json={**ENABLE, "acknowledged": False})
    assert response.status_code == 422
    assert client.get(f"{BASE}/autopilot").json()["settings"]["enabled"] is False


def test_portal_accounts_list_view_export_and_delete(client: TestClient) -> None:
    created = client.post(
        f"{BASE}/accounts", json={"host": HOST, "employer": "Acme", "email": ACCOUNT_EMAIL, "password": "Saved-pass-9"}
    ).json()
    assert "password" not in created and "sealedPassword" not in created
    listed = client.get(f"{BASE}/accounts").json()
    assert [(a["host"], a["employer"], a["email"]) for a in listed] == [(HOST, "Acme", ACCOUNT_EMAIL)]
    assert "password" not in str(listed).lower().replace("passwordfield", "")
    assert client.get(f"{BASE}/accounts/{created['id']}/secret").json()["password"] == "Saved-pass-9"
    assert client.get(f"{BASE}/accounts/export").json()[0]["password"] == "Saved-pass-9"
    assert client.delete(f"{BASE}/accounts/{created['id']}").status_code == 204
    assert client.get(f"{BASE}/accounts").json() == []
    assert client.get(f"{BASE}/accounts/{created['id']}/secret").status_code == 404


def test_attempt_of_an_unknown_application_is_not_found(client: TestClient) -> None:
    assert client.get(f"{BASE}/applications/app_missing/attempt").status_code == 404


def test_readiness_requests_are_stored_and_processed_by_the_portal_worker(client: TestClient, container: Container) -> None:
    created = client.post(f"{BASE}/readiness", json={"url": "javascript:alert(1)"})
    assert created.status_code == 422
    pending = client.post(f"{BASE}/readiness", json={"url": f"https://{HOST}/jobs/1"}).json()
    assert pending["state"] == ReadinessState.PENDING.value
    assert client.get(f"{BASE}/readiness/{pending['id']}").json()["host"] == HOST
    assert [r["id"] for r in client.get(f"{BASE}/readiness").json()] == [pending["id"]]


def test_admins_list_and_decide_hosts(admin: TestClient, container: Container) -> None:
    container.portal.hosts.observe("careers.new.test")
    hosts = {h["host"]: h for h in admin.get(f"{ADMIN_BASE}/hosts").json()}
    assert hosts["careers.new.test"]["policy"] == HostPolicy.REVIEW.value
    assert hosts["easy.jobs"]["configured"] is True
    decided = admin.put(f"{ADMIN_BASE}/hosts/careers.new.test", json={"policy": "allowed", "note": "terms read 2026-11-05"}).json()
    assert decided["policy"] == "allowed" and decided["decidedAt"]
    assert container.portal.hosts.policy_of("careers.new.test") is HostPolicy.ALLOWED
    assert admin.put(f"{ADMIN_BASE}/hosts/bad/host", json={"policy": "allowed"}).status_code in {404, 405, 422}


def test_admin_readiness_request_is_audited(admin: TestClient) -> None:
    created = admin.post(f"{ADMIN_BASE}/readiness", json={"url": f"https://{HOST}/jobs/1"})
    assert created.status_code == 200 and created.json()["state"] == "pending"


def test_user_api_does_not_expose_host_decisions(client: TestClient, container: Container) -> None:
    container.portal.hosts.decide("x.test", HostInput(policy=HostPolicy.ALLOWED))
    assert client.get(f"{ADMIN_BASE}/hosts").status_code == 404


def test_automatic_rules_carry_portal_permissions(client: TestClient) -> None:
    body = {"name": "Portal rule", "portal": {"allowAccountCreation": True, "accountEmail": ACCOUNT_EMAIL, "acceptTerms": False}}
    created = client.post("/v1/automation/rules", json=body)
    assert created.status_code == 200, created.text
    portal = created.json()["portal"]
    assert portal["allowAccountCreation"] is True and portal["acceptTerms"] is False and portal["accountEmail"] == ACCOUNT_EMAIL
