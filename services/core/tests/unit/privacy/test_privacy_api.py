from typing import Any

import pytest
from fastapi.testclient import TestClient

from careerpilot.administration.context import AdminActor, PageRequest
from careerpilot.api.admin_app import create_admin_app
from careerpilot.api.user_app import create_user_app
from careerpilot.bootstrap import Container
from careerpilot.platform.errors import DomainError, ErrorCode
from careerpilot.privacy.enums import ExportFormat, ExportKind
from careerpilot.privacy.exports import ExportSpec
from tests.unit.conftest import CLIENT, DEMO_USER
from tests.unit.privacy.conftest import OWNER_PASSWORD

SECRET_WORDS = ("fileKey", "downloadUrl", "signature", "password", "token")


def user_client(container: Container) -> TestClient:
    client = TestClient(create_user_app(container))
    token = container.auth.sign_in("admin@sober.com", OWNER_PASSWORD, CLIENT).access_token
    client.headers["Authorization"] = f"Bearer {token}"
    return client


def admin_client(container: Container) -> TestClient:
    client = TestClient(create_admin_app(container))
    token = container.admin_auth.sign_in("admin@sober.com", OWNER_PASSWORD, CLIENT.ip).access_token
    client.headers["Authorization"] = f"Bearer {token}"
    return client


def test_report_endpoint_answers_for_both_periods(container: Container) -> None:
    client = user_client(container)
    daily = client.get("/v1/reports/daily", params={"date": "2026-10-17"})
    assert daily.status_code == 200
    assert daily.json()["rows"][0]["applicationId"] == "app_kite"
    assert client.get("/v1/reports/weekly").json()["period"] == "weekly"
    assert client.get("/v1/reports/yearly").status_code == 422


def test_export_endpoints_create_list_and_serve_a_download(container: Container) -> None:
    client = user_client(container)
    created = client.post("/v1/exports", json={"kind": "applications", "format": "csv"})
    assert created.status_code == 200
    ready = client.get(f"/v1/exports/{created.json()['id']}").json()
    assert ready["status"] == "ready"
    assert [item["id"] for item in client.get("/v1/exports").json()] == [ready["id"]]
    download = client.get(ready["downloadUrl"].removeprefix("http://testserver"))
    assert download.status_code == 200
    assert download.headers["content-disposition"].startswith("attachment")
    assert client.post("/v1/exports", json={"kind": "archive", "format": "zip", "password": "nope"}).status_code == 401


def test_deletion_and_consent_endpoints(container: Container) -> None:
    client = user_client(container)
    assert client.get("/v1/account/deletion").json()["plan"]["graceDays"] == 14
    assert client.post("/v1/account/deletion", json={"password": "bad"}).status_code == 401
    scheduled = client.post("/v1/account/deletion", json={"password": OWNER_PASSWORD}).json()
    assert scheduled["status"] == "requested"
    assert client.post("/v1/account/deletion/cancel").json().get("status") is None
    consent = client.put("/v1/account/consents/analytics", json={"granted": True}).json()
    assert {e["kind"]: e["granted"] for e in consent["current"]}["analytics"] is True
    assert client.put("/v1/account/consents/terms", json={"granted": False}).status_code == 422
    assert client.get("/v1/account/consents").json()["history"][0]["kind"] == "analytics"


def test_admins_see_requests_and_consents_without_files_links_or_secrets(container: Container) -> None:
    container.privacy.exports.request(DEMO_USER, ExportSpec(ExportKind.APPLICATIONS, ExportFormat.CSV))
    container.privacy.deletion.request(DEMO_USER, OWNER_PASSWORD)
    client = admin_client(container)
    bodies: list[Any] = [
        client.get("/admin/v1/privacy/exports").json(),
        client.get("/admin/v1/privacy/deletions").json(),
        client.get(f"/admin/v1/users/{DEMO_USER}/consents").json(),
    ]
    assert bodies[0][0]["status"] == "ready"
    assert bodies[1][0]["status"] == "requested"
    text = str(bodies)
    for word in SECRET_WORDS:
        assert word.lower() not in text.lower().replace("userid", "")
    assert client.get("/admin/v1/users/usr_missing/consents").status_code == 404


def test_admin_views_are_audited(container: Container, admin: AdminActor) -> None:
    container.privacy.admin.exports(admin)
    container.privacy.admin.deletions(admin)
    actions = [e.action for e in container.admin_audit.list(admin, PageRequest()).items]
    assert actions[:2] == ["privacy.deletions_viewed", "privacy.exports_viewed"]
    with pytest.raises(DomainError) as error:
        container.privacy.admin.consents(admin, "usr_missing")
    assert error.value.code is ErrorCode.NOT_FOUND
