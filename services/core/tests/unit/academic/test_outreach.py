from typing import Any

from fastapi.testclient import TestClient

from tests.unit.academic.conftest import BASE

WORK = "graph neural networks for protein design"


def draft_body(
    name: str = "Prof Lee", university: str = "Northern University", department: str = "CS", **changes: object
) -> dict[str, Any]:
    return {"supervisorName": name, "university": university, "department": department, "researchReference": WORK, **changes}


def draft(client: TestClient, **changes: Any) -> dict[str, Any]:
    response = client.post(f"{BASE}/outreach", json=draft_body(**changes))
    assert response.status_code == 200, response.text
    body: dict[str, Any] = response.json()
    return body


def test_a_draft_uses_the_profile_and_the_supervisors_real_work_and_is_not_sent(client: TestClient) -> None:
    created = draft(client)
    assert created["status"] == "draft"
    assert WORK in created["body"]
    assert "Ayesha Rahman" in created["body"]
    assert "Prof Lee" in created["body"]
    assert created["subject"] == f"Question about your research on {WORK}"
    assert created.get("sentOn") is None


def test_a_draft_requires_a_real_research_reference_and_is_not_duplicated(client: TestClient) -> None:
    assert client.post(f"{BASE}/outreach", json=draft_body(researchReference="AI")).status_code == 422
    draft(client)
    assert client.post(f"{BASE}/outreach", json=draft_body()).status_code == 409


def test_sending_is_recorded_by_the_user_and_the_body_must_still_name_the_work(client: TestClient) -> None:
    created = draft(client)
    edited = client.put(f"{BASE}/outreach/{created['id']}", json={**created, "body": "Dear Professor, I am keen to join your lab."})
    assert edited.status_code == 200
    assert client.post(f"{BASE}/outreach/{created['id']}/sent", json={}).status_code == 422
    restored = client.put(f"{BASE}/outreach/{created['id']}", json={**created})
    assert restored.status_code == 200
    sent = client.post(f"{BASE}/outreach/{created['id']}/sent", json={}).json()
    assert (sent["status"], sent["sentOn"]) == ("sent", "2026-10-20")


def test_the_daily_university_and_department_limits_are_enforced(client: TestClient) -> None:
    assert client.put(f"{BASE}/settings", json={"maxPerDay": 2, "maxPerDepartment": 1, "maxPerUniversity": 3}).status_code == 200
    first = draft(client, name="Prof A")
    second = draft(client, name="Prof B")
    other = draft(client, name="Prof C", department="Physics")
    assert client.post(f"{BASE}/outreach/{first['id']}/sent", json={}).status_code == 200
    assert client.post(f"{BASE}/outreach/{second['id']}/sent", json={}).status_code == 422
    assert client.post(f"{BASE}/outreach/{other['id']}/sent", json={}).status_code == 200
    elsewhere = draft(client, name="Prof D", university="Southern University", department="CS")
    assert client.post(f"{BASE}/outreach/{elsewhere['id']}/sent", json={}).status_code == 422
    assert client.post(f"{BASE}/outreach/{elsewhere['id']}/sent", json={"on": "2026-10-21"}).status_code == 200


def test_limits_cannot_exceed_the_configured_maximum(client: TestClient) -> None:
    assert client.put(f"{BASE}/settings", json={"maxPerDay": 500}).status_code == 422
    assert client.put(f"{BASE}/settings", json={"followUpsAllowed": True}).json()["followUpsAllowed"] is True


def test_a_decline_stops_all_further_outreach_to_that_professor(client: TestClient) -> None:
    created = draft(client)
    assert client.post(f"{BASE}/outreach/{created['id']}/reply", json={"outcome": "declined"}).status_code == 422
    client.post(f"{BASE}/outreach/{created['id']}/sent", json={})
    declined = client.post(f"{BASE}/outreach/{created['id']}/reply", json={"outcome": "declined", "note": "no capacity"}).json()
    assert (declined["status"], declined["doNotContact"]) == ("declined", True)
    assert client.post(f"{BASE}/outreach/{created['id']}/sent", json={"on": "2026-11-30"}).status_code == 422
    assert client.post(f"{BASE}/outreach", json=draft_body()).status_code == 422


def test_follow_ups_need_permission_and_a_gap(client: TestClient) -> None:
    client.put(f"{BASE}/settings", json={"followUpsAllowed": True})
    created = draft(client)
    client.put(f"{BASE}/outreach/{created['id']}", json={**created, "allowFollowUp": True})
    client.post(f"{BASE}/outreach/{created['id']}/sent", json={})
    url = f"{BASE}/outreach/{created['id']}/sent"
    assert client.post(url, json={"on": "2026-10-22"}).status_code == 422
    again = client.post(url, json={"on": "2026-11-05"}).json()
    assert (again["followUpsSent"], again["lastSentOn"]) == (1, "2026-11-05")
    blocked = draft(client, name="Prof Z")
    client.post(f"{BASE}/outreach/{blocked['id']}/sent", json={})
    client.put(f"{BASE}/settings", json={"followUpsAllowed": False})
    assert client.post(f"{BASE}/outreach/{blocked['id']}/sent", json={"on": "2026-12-30"}).status_code == 422


def test_positive_replies_are_raised_first_in_the_overview(client: TestClient) -> None:
    created = draft(client)
    client.post(f"{BASE}/outreach/{created['id']}/sent", json={})
    client.post(f"{BASE}/outreach/{created['id']}/reply", json={"outcome": "call_requested"})
    overview = client.get(f"{BASE}/overview").json()
    assert overview["attention"][0] == {"kind": "outreach_reply", "recordId": created["id"]}
