from fastapi.testclient import TestClient

from tests.unit.academic.conftest import BASE, make_program, make_referee, program_body


def test_a_program_keeps_each_requirement_with_its_evidence_label_and_never_assumes_a_waiver(client: TestClient) -> None:
    created = make_program(
        client,
        examRequirements=[{"exam": "ielts", "need": "required", "evidence": "explicit", "minOverall": 6.5}, {"exam": "gre"}],
        funding={"status": "stated", "fundingPerYear": 12000, "durationMonths": 24, "currency": "EUR"},
    )
    gre = created["examRequirements"][1]
    assert (gre["need"], gre["evidence"], gre["policy"]) == ("not_stated", "not_stated", "not_stated")
    assert gre["waiverDescribed"] is False
    assert created["funding"]["status"] == "stated"
    assert make_program(client)["funding"]["status"] == "not_stated"


def test_programs_can_be_edited_listed_and_soft_removed(client: TestClient) -> None:
    created = make_program(client)
    updated = client.put(f"{BASE}/programs/{created['id']}", json=program_body(title="MSc AI", notes="Strong fit"))
    assert updated.json()["title"] == "MSc AI"
    assert [p["id"] for p in client.get(f"{BASE}/programs").json()] == [created["id"]]
    assert client.delete(f"{BASE}/programs/{created['id']}").status_code == 204
    assert client.get(f"{BASE}/programs/{created['id']}").status_code == 404
    assert client.get(f"{BASE}/programs").json() == []


def test_a_program_is_created_from_a_discovered_opportunity_and_only_once(client: TestClient) -> None:
    created = client.post(f"{BASE}/programs/from-opportunity", json={"opportunityId": "opp_masters_tum"})
    body = created.json()
    assert created.status_code == 200
    assert (body["kind"], body["university"], body["countryCode"]) == ("taught_masters", "Alpine Technical University", "DE")
    assert body["opportunityId"] == "opp_masters_tum"
    assert [(d["kind"], d["on"]) for d in body["deadlines"]] == [("application", "2026-11-19")]
    assert body["examRequirements"] == []
    assert client.post(f"{BASE}/programs/from-opportunity", json={"opportunityId": "opp_masters_tum"}).status_code == 409
    assert client.post(f"{BASE}/programs/from-opportunity", json={"opportunityId": "opp_remote_frontend"}).status_code == 422


def test_a_scholarship_is_a_separate_opportunity_linked_to_programs(client: TestClient) -> None:
    program = make_program(client)
    scholarship = make_program(client, kind="scholarship", title="National Fellowship", linkedProgramIds=[program["id"]])
    assert scholarship["linkedProgramIds"] == [program["id"]]
    assert client.post(f"{BASE}/programs", json=program_body(linkedProgramIds=["acp_unknown"])).status_code == 422


def test_separate_deadlines_are_kept_by_kind(client: TestClient) -> None:
    created = make_program(
        client,
        deadlines=[
            {"kind": "application", "on": "2026-12-15"},
            {"kind": "scholarship_consideration", "on": "2026-11-30"},
            {"kind": "supervisor_contact", "on": "2026-11-01"},
        ],
    )
    assert {d["kind"] for d in created["deadlines"]} == {"application", "scholarship_consideration", "supervisor_contact"}


def test_portal_invites_need_a_referee_who_agreed_to_be_listed(client: TestClient) -> None:
    program = make_program(client)
    unconsented = make_referee(client, consent=False)
    refused = client.put(f"{BASE}/programs/{program['id']}", json=program_body(portal={"invites": [{"refereeId": unconsented["id"]}]}))
    assert refused.status_code == 422
    consented = make_referee(client)
    allowed = client.put(f"{BASE}/programs/{program['id']}", json=program_body(portal={"invites": [{"refereeId": consented["id"]}]}))
    assert allowed.json()["portal"]["invites"][0]["authorizedOn"] == "2026-10-20"
    assert allowed.json()["portal"]["invites"][0].get("invitedOn") is None
