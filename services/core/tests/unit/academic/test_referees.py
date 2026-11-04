from typing import Any

from fastapi.testclient import TestClient

from tests.unit.academic.conftest import BASE, make_program, make_referee


def recommendation_body(referee: dict[str, Any], program: dict[str, Any], **changes: object) -> dict[str, Any]:
    return {"refereeId": referee["id"], "programId": program["id"], "method": "portal_invite", **changes}


def test_a_referee_starts_without_consent_and_cannot_be_used(client: TestClient) -> None:
    program = make_program(client)
    referee = make_referee(client, consent=False)
    assert referee.get("consentConfirmedOn") is None
    refused = client.post(f"{BASE}/recommendations", json=recommendation_body(referee, program))
    assert refused.status_code == 422
    assert refused.json()["detail"] == "referee_consent_required"


def test_confirming_consent_unlocks_recommendations_and_drafts(client: TestClient) -> None:
    program = make_program(client, title="PhD Robotics")
    referee = make_referee(client)
    assert referee["consentConfirmedOn"] == "2026-10-20"
    created = client.post(
        f"{BASE}/recommendations", json=recommendation_body(referee, program, refereeDeadline="2026-12-01", requestedOn="2026-10-20")
    ).json()
    draft = client.get(f"{BASE}/recommendations/{created['id']}/draft").json()
    assert "PhD Robotics" in draft["subject"]
    assert "2026-12-01" in draft["body"]
    assert "Dr Rahim" in draft["body"]
    reminder = client.get(f"{BASE}/recommendations/{created['id']}/draft", params={"kind": "reminder"}).json()
    assert reminder["subject"].startswith("Reminder")


def test_withdrawing_consent_blocks_further_use_and_clears_invites(client: TestClient) -> None:
    program = make_program(client)
    referee = make_referee(client)
    created = client.post(f"{BASE}/recommendations", json=recommendation_body(referee, program, inviteAuthorized=True)).json()
    assert created["inviteAuthorized"] is True
    withdrawn = client.put(f"{BASE}/referees/{referee['id']}/consent", json={"confirmed": False}).json()
    assert withdrawn.get("consentConfirmedOn") is None
    stored = client.get(f"{BASE}/recommendations").json()[0]
    assert stored["inviteAuthorized"] is False
    assert client.get(f"{BASE}/recommendations/{created['id']}/draft").status_code == 422
    plan = client.get(f"{BASE}/programs/{program['id']}/plan").json()
    assert "referee_without_consent" in [w["kind"] for w in plan["warnings"]]
    assert "referee_not_consented" in plan["blockers"]


def test_submitted_needs_evidence_and_confirmed_needs_the_institution(client: TestClient) -> None:
    program = make_program(client)
    referee = make_referee(client)
    created = client.post(f"{BASE}/recommendations", json=recommendation_body(referee, program)).json()
    url = f"{BASE}/recommendations/{created['id']}/status"
    assert client.post(url, json={"status": "submitted"}).status_code == 422
    assert client.post(url, json={"status": "submitted", "evidence": "user_statement"}).status_code == 422
    submitted = client.post(url, json={"status": "submitted", "evidence": "user_statement", "evidenceNote": "Dr Rahim emailed me"})
    assert submitted.json()["status"] == "submitted"
    assert client.post(url, json={"status": "confirmed", "evidence": "user_statement", "evidenceNote": "x"}).status_code == 422
    confirmed = client.post(url, json={"status": "confirmed", "evidence": "institution_confirmation", "on": "2026-10-19"})
    assert (confirmed.json()["status"], confirmed.json()["evidenceOn"]) == ("confirmed", "2026-10-19")
    requested = client.post(url, json={"status": "requested"}).json()
    assert requested.get("evidence") is None


def test_editing_a_recommendation_keeps_its_evidence_and_removal_is_soft(client: TestClient) -> None:
    program = make_program(client)
    referee = make_referee(client)
    created = client.post(f"{BASE}/recommendations", json=recommendation_body(referee, program)).json()
    client.post(
        f"{BASE}/recommendations/{created['id']}/status",
        json={"status": "submitted", "evidence": "user_statement", "evidenceNote": "told by email"},
    )
    edited = client.put(f"{BASE}/recommendations/{created['id']}", json=recommendation_body(referee, program, agreement="agreed"))
    assert (edited.json()["status"], edited.json()["agreement"]) == ("submitted", "agreed")
    assert client.delete(f"{BASE}/referees/{referee['id']}").status_code == 204
    assert client.get(f"{BASE}/recommendations").json() == []
