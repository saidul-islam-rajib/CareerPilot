import pytest
from fastapi.testclient import TestClient

from careerpilot.api.admin_app import create_admin_app
from careerpilot.api.user_app import create_user_app
from careerpilot.bootstrap import Container

PASSWORD = "admin@sober.com"


@pytest.fixture
def user_client(container: Container) -> TestClient:
    return TestClient(create_user_app(container))


@pytest.fixture
def admin_client(container: Container) -> TestClient:
    return TestClient(create_admin_app(container))


def user_headers(client: TestClient) -> dict[str, str]:
    token = client.post("/v1/auth/sign-in", json={"email": "admin@sober.com", "password": PASSWORD}).json()["accessToken"]
    return {"Authorization": f"Bearer {token}"}


def admin_headers(client: TestClient, email: str = "admin@sober.com") -> dict[str, str]:
    token = client.post("/admin/v1/auth/sign-in", json={"email": email, "password": PASSWORD}).json()["accessToken"]
    return {"Authorization": f"Bearer {token}"}


def test_sign_in_returns_camel_case_session(user_client: TestClient) -> None:
    response = user_client.post("/v1/auth/sign-in", json={"email": "admin@sober.com", "password": PASSWORD})
    assert response.status_code == 200
    assert response.json()["user"]["fullName"] == "Ayesha Rahman"


def test_errors_use_problem_details_codes(user_client: TestClient) -> None:
    wrong = user_client.post("/v1/auth/sign-in", json={"email": "admin@sober.com", "password": "nope"})
    assert wrong.status_code == 401
    assert wrong.json()["code"] == "invalid_credentials"
    assert wrong.headers["content-type"].startswith("application/problem+json")
    anonymous = user_client.get("/v1/dashboard")
    assert anonymous.status_code == 401
    assert anonymous.json()["code"] == "unauthorized"
    invalid = user_client.post("/v1/auth/sign-in", json={"email": 1})
    assert invalid.status_code == 422
    assert invalid.json()["code"] == "validation"


def test_register_conflicts_on_existing_email(user_client: TestClient) -> None:
    body = {
        "fullName": "Dup",
        "email": "admin@sober.com",
        "password": "Str0ng!Password",
        "consent": True,
        "consentDocuments": {"terms": "1", "privacy": "1"},
    }
    response = user_client.post("/v1/auth/register", json=body)
    assert response.status_code == 409
    assert response.json()["code"] == "email_taken"


def test_dashboard_and_config_shapes(user_client: TestClient) -> None:
    headers = user_headers(user_client)
    dashboard = user_client.get("/v1/dashboard", headers=headers).json()
    assert set(dashboard["counts"]) == {"newMatches", "awaitingApproval", "appliedThisWeek", "interviews"}
    assert dashboard["tracks"][0]["track"]["resultCount"] == 5
    config = user_client.get("/v1/config").json()
    assert config["validationPolicy"]["password"]["minLength"] == 10
    assert any(v["enumKey"] == "submission_status" for v in config["enumValues"])


def test_approval_flow_over_http(user_client: TestClient) -> None:
    headers = user_headers(user_client)
    answered = user_client.put("/v1/approvals/apr_frontend/answers/q_notice", json={"answer": "15 days"}, headers=headers)
    assert answered.status_code == 200
    approved = user_client.post("/v1/approvals/apr_frontend/approve", headers=headers).json()
    assert approved["state"] == "approved"
    active = user_client.get("/v1/applications", params={"filter": "active"}, headers=headers).json()
    assert any(a["submissionStatus"] == "approved_queued" for a in active)
    assert user_client.post("/v1/approvals/apr_frontend/approve", headers=headers).status_code == 409


def test_settings_endpoints(user_client: TestClient) -> None:
    headers = user_headers(user_client)
    assert user_client.patch("/v1/settings/tracks/trk_remote", json={"resultCount": 7}, headers=headers).json()["resultCount"] == 7
    assert user_client.post("/v1/settings/pause", json={"duration": "indefinite"}, headers=headers).json()["pause"]["scope"] == "all"
    assert "pause" not in user_client.post("/v1/settings/resume", headers=headers).json()
    window = {"kind": "daily_window", "start": "00:00", "end": "01:00"}
    assert user_client.put("/v1/settings/submission-window", json=window, headers=headers).status_code == 200
    assert user_client.put("/v1/opportunities/opp_bd_ctg/decision", json={"decision": "saved"}, headers=headers).status_code == 204


def test_user_tokens_cannot_call_admin_api(user_client: TestClient, admin_client: TestClient) -> None:
    assert admin_client.get("/admin/v1/dashboard", headers=user_headers(user_client)).status_code == 401


def test_admin_paging_permissions_and_theme(user_client: TestClient, admin_client: TestClient) -> None:
    headers = admin_headers(admin_client)
    users = admin_client.get("/admin/v1/users", params={"page": 2, "pageSize": 10}, headers=headers).json()
    assert users["total"] == 14
    assert users["pageSize"] == 10
    assert len(users["items"]) == 4
    viewer = admin_headers(admin_client, "viewer@sober.com")
    forbidden = admin_client.post("/admin/v1/users/usr_002/suspend", json={"reason": "x"}, headers=viewer)
    assert forbidden.status_code == 403
    assert forbidden.json()["code"] == "forbidden"
    assert admin_client.patch("/admin/v1/settings", json={"activeTheme": "horizon"}, headers=headers).json()["activeTheme"] == "horizon"
    assert user_client.get("/v1/config").json()["theme"] == "horizon"


def test_admin_dashboard_and_audit(admin_client: TestClient) -> None:
    headers = admin_headers(admin_client)
    dashboard = admin_client.get("/admin/v1/dashboard", headers=headers).json()
    assert dashboard["sources"]["failing"] == 1
    sources = admin_client.get("/admin/v1/sources", headers=headers).json()
    assert "failuresLast24h" in sources["items"][0]
    audit = admin_client.get("/admin/v1/audit", headers=headers).json()
    assert audit["items"][0]["action"] == "admin.signed_in"


def test_security_headers_present(user_client: TestClient) -> None:
    response = user_client.get("/v1/config")
    assert response.headers["X-Content-Type-Options"] == "nosniff"
    assert response.headers["Cache-Control"] == "no-store"
