from typing import Any

from fastapi.testclient import TestClient

from tests.unit.academic.conftest import BASE, make_program, make_referee, program_body


def test_the_plan_works_backwards_from_each_deadline_and_keeps_early_deadlines_separate(client: TestClient) -> None:
    program = make_program(
        client,
        supervisor="Prof Lee",
        examRequirements=[{"exam": "ielts", "need": "required", "evidence": "explicit"}],
        deadlines=[
            {"kind": "application", "on": "2027-01-15"},
            {"kind": "scholarship_consideration", "on": "2026-12-01"},
            {"kind": "referee", "on": "2027-01-08"},
        ],
    )
    steps = client.get(f"{BASE}/programs/{program['id']}/plan").json()["steps"]
    by_kind = {(s["kind"], s["deadlineKind"]): s["on"] for s in steps}
    assert by_kind[("submit_application", "application")] == "2027-01-12"
    assert by_kind[("submit_application", "scholarship_consideration")] == "2026-11-28"
    assert by_kind[("request_referees", "referee")] == "2026-12-11"
    assert by_kind[("prepare_documents", "application")] == "2026-11-01"
    assert by_kind[("send_scores", "application")] == "2026-11-10"
    assert ("take_test", "test_date") in by_kind
    assert ("test_registration", "test_registration") in by_kind
    assert ("contact_supervisor", "supervisor_contact") in by_kind
    assert [s["on"] for s in steps] == sorted(s["on"] for s in steps)


def test_the_budget_separates_official_amounts_from_estimates_per_currency(client: TestClient) -> None:
    program = make_program(
        client,
        fee={"amount": 90, "currency": "USD", "source": "official", "waiverNote": "Waived for some applicants"},
        budget=[
            {"kind": "test_fee", "amount": 250, "currency": "USD", "source": "official"},
            {"kind": "courier", "amount": 60, "currency": "USD", "source": "estimate"},
            {"kind": "translation", "amount": 4000, "currency": "BDT", "source": "estimate"},
        ],
    )
    totals = client.get(f"{BASE}/programs/{program['id']}/plan").json()["budget"]
    assert totals == [
        {"currency": "BDT", "official": 0.0, "estimate": 4000.0, "total": 4000.0},
        {"currency": "USD", "official": 340.0, "estimate": 60.0, "total": 400.0},
    ]
    assert program["fee"]["waiverNote"] == "Waived for some applicants"


def test_portal_blockers_list_what_stops_submission(client: TestClient) -> None:
    referee = make_referee(client)
    program = make_program(
        client,
        credentialRequirements=[{"need": "evaluation", "evidence": "explicit"}],
        portal={
            "accountLabel": "me@example.org",
            "sections": [{"name": "Personal", "done": True}, {"name": "Statement", "done": False}],
            "documents": [{"name": "Transcript", "uploaded": False}],
            "fee": "due",
            "pendingItems": [{"name": "Official transcript", "received": False}],
        },
    )
    client.post(f"{BASE}/recommendations", json={"refereeId": referee["id"], "programId": program["id"], "method": "portal_invite"})
    blockers = client.get(f"{BASE}/programs/{program['id']}/plan").json()["blockers"]
    assert blockers == [
        "section_incomplete",
        "document_missing",
        "referee_not_invited",
        "fee_due",
        "institution_item_pending",
        "credential_pending",
    ]
    assert "password" not in str(program["portal"]).lower()


def offer_program(client: TestClient, **changes: object) -> dict[str, Any]:
    program = make_program(client, startsOn="2027-09-01", **changes)
    decision = {
        "kind": "conditionally_accepted",
        "conditions": [{"text": "Final transcript", "due": "2027-06-30"}],
        "acceptanceDeadline": "2026-12-20",
        "depositAmount": 500,
        "depositCurrency": "EUR",
    }
    saved = client.put(f"{BASE}/programs/{program['id']}", json=program_body(startsOn="2027-09-01", decision=decision, **changes))
    assert saved.status_code == 200
    result: dict[str, Any] = saved.json()
    return result


def test_accepting_paying_and_declining_are_only_recorded_after_explicit_confirmation(client: TestClient) -> None:
    program = offer_program(client)
    url = f"{BASE}/programs/{program['id']}/decision/actions"
    assert client.post(url, json={"action": "accept_offer"}).status_code == 422
    done = client.post(url, json={"action": "accept_offer", "confirmed": True}).json()
    assert done["decision"]["actions"] == [{"action": "accept_offer", "confirmedOn": "2026-10-20"}]
    kept = client.put(f"{BASE}/programs/{program['id']}", json=program_body(decision={"kind": "accepted"}))
    assert kept.json()["decision"]["actions"] == done["decision"]["actions"]
    draft = client.get(f"{BASE}/programs/{program['id']}/decision/message", params={"action": "decline_offer"}).json()
    assert "MSc Data Science" in draft["subject"]
    assert "Ayesha Rahman" in draft["body"]


def test_actions_need_an_offer(client: TestClient) -> None:
    pending = make_program(client)
    url = f"{BASE}/programs/{pending['id']}/decision/actions"
    assert client.post(url, json={"action": "pay_deposit", "confirmed": True}).status_code == 422
    assert client.post(f"{BASE}/programs/{pending['id']}/checklist").status_code == 422


def test_the_after_admission_checklist_is_built_from_config_and_the_start_date(client: TestClient) -> None:
    program = offer_program(client)
    created = client.post(f"{BASE}/programs/{program['id']}/checklist").json()
    items = {item["step"]: item for item in created["checklist"]}
    assert set(items) == {
        "admission_document",
        "proof_of_funds",
        "visa",
        "health_insurance",
        "accommodation",
        "tuition_payment",
        "travel",
        "arrival_registration",
    }
    assert items["visa"]["dueOn"] == "2027-06-03"
    assert items["visa"]["status"] == "todo"
    again = client.post(f"{BASE}/programs/{program['id']}/checklist").json()
    assert len(again["checklist"]) == 8
    updated = {**again["checklist"][0], "status": "done", "sourceUrl": "https://example.edu/i20", "sourceCheckedOn": "2026-10-20"}
    saved = client.put(
        f"{BASE}/programs/{program['id']}",
        json=program_body(startsOn="2027-09-01", decision={"kind": "accepted"}, checklist=[updated, *again["checklist"][1:]]),
    ).json()
    assert saved["checklist"][0]["sourceUrl"] == "https://example.edu/i20"


def test_offers_are_compared_with_stated_values_and_estimates_are_labelled(client: TestClient) -> None:
    funded = offer_program(
        client,
        title="Funded MSc",
        funding={
            "status": "stated",
            "tuitionPerYear": 3000,
            "livingCostPerYear": 12000,
            "fundingPerYear": 10000,
            "durationMonths": 24,
            "currency": "EUR",
        },
    )
    unknown = offer_program(client, title="Unclear MSc")
    make_program(client, title="Still pending")
    rows = {r["title"]: r for r in client.get("/v1/academic/offers/compare").json()}
    assert set(rows) == {"Funded MSc", "Unclear MSc"}
    assert rows["Funded MSc"]["totalCost"] == {"amount": 30000.0, "estimated": True}
    assert rows["Funded MSc"]["fundingTotal"] == {"amount": 20000.0, "estimated": True}
    assert rows["Funded MSc"]["netCost"] == {"amount": 10000.0, "estimated": True}
    assert rows["Unclear MSc"]["totalCost"] == {"estimated": False}
    only = client.get("/v1/academic/offers/compare", params={"ids": funded["id"]}).json()
    assert [r["programId"] for r in only] == [funded["id"]]
    assert unknown["id"] not in [r["programId"] for r in only]


def test_the_overview_lists_upcoming_dates_and_blocked_portals(client: TestClient) -> None:
    make_program(
        client,
        deadlines=[{"kind": "application", "on": "2026-11-10"}, {"kind": "funding", "on": "2027-03-01"}],
        portal={"submission": "in_progress", "sections": [{"name": "Statement", "done": False}]},
    )
    overview = client.get(f"{BASE}/overview").json()
    assert overview["programs"] == 1
    assert [(u["kind"], u["on"]) for u in overview["upcoming"]] == [("application", "2026-11-10")]
    assert [a["kind"] for a in overview["attention"]] == ["portal_blocked", "deadline_soon"]


def test_the_reference_gives_the_clients_their_options(client: TestClient) -> None:
    reference = client.get(f"{BASE}/reference").json()
    assert {e["kind"] for e in reference["exams"]} >= {"ielts", "toefl", "gre", "sat"}
    assert reference["maxPerDay"] == 5
    assert reference["checklistSteps"][0] == "admission_document"
