from fastapi.testclient import TestClient

from careerpilot.api.user_app import create_user_app
from careerpilot.bootstrap import Container
from tests.unit.automation.conftest import REMOTE_TRACK, make_remote_automatic
from tests.unit.conftest import CLIENT

PASSWORD = "admin@sober.com"


def client_for(container: Container) -> TestClient:
    client = TestClient(create_user_app(container))
    token = container.auth.sign_in("admin@sober.com", PASSWORD, CLIENT).access_token
    client.headers["Authorization"] = f"Bearer {token}"
    return client


def test_requires_sign_in(service: Container) -> None:
    anonymous = TestClient(create_user_app(service))
    assert anonymous.get("/v1/automation").status_code == 401
    assert anonymous.post("/v1/automation/dry-run", json={}).status_code == 401


def test_rules_settings_and_dry_run_over_http(service: Container) -> None:
    make_remote_automatic(service)
    client = client_for(service)
    empty = client.get("/v1/automation").json()
    assert empty["rules"] == [] and empty["holds"] == []
    assert "captcha_or_human_check" in empty["userOnlySteps"]
    created = client.post("/v1/automation/rules", json={"name": "Remote", "trackIds": [REMOTE_TRACK], "filters": {"minMatchScore": 40}})
    assert created.status_code == 200
    rule_id = created.json()["id"]
    assert client.post("/v1/automation/rules", json={"name": "x", "filters": {"minMatchScore": 500}}).status_code == 422
    second = client.post("/v1/automation/rules", json={"name": "Second"}).json()["id"]
    ordered = client.put("/v1/automation/rules/order", json={"ruleIds": [second, rule_id]}).json()
    assert [r["id"] for r in ordered] == [second, rule_id]
    preview = client.post("/v1/automation/dry-run", json={"ruleId": rule_id}).json()
    assert preview["submitted"] == 0 and preview["wouldApply"] >= 1
    saved = client.put("/v1/automation/settings", json={"deadlineBufferHours": 12, "deadlineAction": "skip"}).json()
    assert saved["deadlineBufferHours"] == 12 and saved["deadlineAction"] == "skip"
    assert client.delete(f"/v1/automation/rules/{rule_id}").status_code == 204
    assert client.put("/v1/automation/rules/rul_missing", json={"name": "x"}).status_code == 404
