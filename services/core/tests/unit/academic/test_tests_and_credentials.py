from typing import Any

from fastapi.testclient import TestClient

from tests.unit.academic.conftest import BASE, make_program


def make_exam(client: TestClient, **changes: object) -> dict[str, Any]:
    body = {
        "exam": "ielts",
        "status": "scores_released",
        "testOn": "2026-03-01",
        "scoreReleaseOn": "2026-03-14",
        "scores": {"overall": 7.0},
        **changes,
    }
    response = client.post(f"{BASE}/tests", json=body)
    assert response.status_code == 200, response.text
    result: dict[str, Any] = response.json()
    return result


def test_score_expiry_comes_from_the_release_date_and_the_configured_validity(client: TestClient) -> None:
    assert make_exam(client)["expiresOn"] == "2028-03-14"
    assert make_exam(client, validityMonths=12)["expiresOn"] == "2027-03-14"
    assert make_exam(client, exam="gre", scoreReleaseOn=None)["expiresOn"] == "2031-03-01"


def test_scores_use_the_known_sections_and_are_never_invented(client: TestClient) -> None:
    planned = make_exam(client, status="planned", scoreReleaseOn=None, testOn=None, scores=None)
    assert planned.get("scores") is None
    assert planned.get("expiresOn") is None
    ok = make_exam(client, scores={"overall": 7.0, "sections": {"listening": 7.5}})
    assert ok["scores"]["sections"] == {"listening": 7.5}
    bad = client.post(f"{BASE}/tests", json={"exam": "ielts", "scores": {"sections": {"calculus": 5}}})
    assert bad.status_code == 422


def test_a_warning_is_raised_when_a_score_expires_before_the_deadline_or_the_start(client: TestClient) -> None:
    make_exam(client, validityMonths=6)
    deadline = make_program(
        client,
        examRequirements=[{"exam": "ielts", "need": "required", "evidence": "explicit"}],
        deadlines=[{"kind": "application", "on": "2026-12-01"}],
    )
    plan = client.get(f"{BASE}/programs/{deadline['id']}/plan").json()
    assert [(w["kind"], w["on"]) for w in plan["warnings"]] == [("score_expires_before_deadline", "2026-09-14")]
    start = make_program(
        client,
        examRequirements=[{"exam": "ielts", "need": "required", "evidence": "explicit"}],
        deadlines=[{"kind": "application", "on": "2026-08-01"}],
        startsOn="2027-09-01",
    )
    assert client.get(f"{BASE}/programs/{start['id']}/plan").json()["warnings"][0]["kind"] == "score_expires_before_start"
    fine = make_exam(client, exam="gre")
    assert fine["expiresOn"] == "2031-03-14"


def test_a_missing_required_score_is_flagged_and_an_optional_one_is_not(client: TestClient) -> None:
    program = make_program(
        client,
        examRequirements=[
            {"exam": "toefl", "need": "required"},
            {"exam": "gre", "need": "optional"},
            {"exam": "sat", "need": "not_stated"},
        ],
    )
    warnings = client.get(f"{BASE}/programs/{program['id']}/plan").json()["warnings"]
    assert [(w["kind"], w["exam"]) for w in warnings] == [("no_valid_score", "toefl")]


def test_official_score_reports_record_the_institution_and_its_confirmation(client: TestClient) -> None:
    program = make_program(client)
    exam = make_exam(client)
    report = {"programId": program["id"], "institutionCode": "1234", "sentOn": "2026-10-01", "feeAmount": 25, "feeCurrency": "USD"}
    updated = client.put(f"{BASE}/tests/{exam['id']}", json={**exam, "reports": [report, {**report, "confirmedReceipt": True}]})
    reports = updated.json()["reports"]
    assert reports[0]["id"] and reports[0]["confirmedReceipt"] is False
    assert reports[1]["confirmedOn"] == "2026-10-20"
    unknown = client.put(f"{BASE}/tests/{exam['id']}", json={**exam, "reports": [{**report, "programId": "acp_other"}]})
    assert unknown.status_code == 422


def test_credentials_keep_the_original_scale_and_label_conversions(client: TestClient) -> None:
    base = {
        "kind": "transcript",
        "institution": "Dhaka University",
        "title": "BSc CSE",
        "scale": "cgpa_4",
        "value": "3.42",
        "outOf": "4.00",
    }
    plain = client.post(f"{BASE}/credentials", json=base).json()
    assert (plain["value"], plain["scale"], plain["conversionIsEstimate"]) == ("3.42", "cgpa_4", False)
    estimated = client.post(f"{BASE}/credentials", json={**base, "convertedValue": "85%"}).json()
    assert (estimated["conversionSource"], estimated["conversionIsEstimate"]) == ("estimate", True)
    official = client.post(f"{BASE}/credentials", json={**base, "convertedValue": "85%", "conversionSource": "official"}).json()
    assert official["conversionIsEstimate"] is False
    assert client.delete(f"{BASE}/credentials/{plain['id']}").status_code == 204
    assert len(client.get(f"{BASE}/credentials").json()) == 2
