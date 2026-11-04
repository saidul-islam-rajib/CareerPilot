from datetime import timedelta

import pytest
from fastapi.testclient import TestClient

from careerpilot.bootstrap import Container
from careerpilot.platform.clock import FixedClock
from careerpilot.platform.files import sample_pdf
from tests.unit.government.conftest import fill_profile, publish

PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 16
APPLICATIONS = "/v1/government/applications"
TRANSACTION = "TXN-ABC-9981"


@pytest.fixture
def tracked(
    container: Container, user_client: TestClient, admin_client: TestClient, user_headers: dict[str, str], admin_headers: dict[str, str]
) -> dict[str, object]:
    fill_profile(container)
    created = publish(admin_client, admin_headers)
    body = user_client.post(
        APPLICATIONS,
        json={"circularId": created["id"], "postIds": [created["posts"][0]["id"]]},
        headers=user_headers,  # type: ignore[index]
    )
    assert body.status_code == 200
    result: dict[str, object] = body.json()
    return result


def test_tracking_starts_with_the_fee_due_and_the_closing_date_as_the_application_stage(tracked: dict[str, object]) -> None:
    assert tracked["status"] == "preparing"
    assert tracked["fee"] == {"amount": 112, "currency": "BDT", "status": "due", "method": "mobile_banking", "evidenceNote": ""}
    stages = tracked["stages"]
    assert [(s["stage"], s["on"], s["source"]) for s in stages] == [("application", "2026-11-12", "official_notice")]  # type: ignore[index]
    assert tracked["circularVersion"] == 1


def test_the_same_circular_cannot_be_tracked_twice(
    tracked: dict[str, object], user_client: TestClient, user_headers: dict[str, str]
) -> None:
    again = user_client.post(APPLICATIONS, json={"circularId": tracked["circularId"], "postIds": tracked["postIds"]}, headers=user_headers)
    assert again.status_code == 409
    unknown = user_client.post(APPLICATIONS, json={"circularId": tracked["circularId"], "postIds": ["nope"]}, headers=user_headers)
    assert unknown.status_code == 422


def urgency(container: Container, tracked: dict[str, object]) -> str:
    return container.government.tracking.get("usr_demo", str(tracked["id"]), "http://api.test/").fee_urgency.value


def test_the_payment_deadline_starts_when_the_user_records_submission_and_urgency_follows_the_clock(
    tracked: dict[str, object],
    user_client: TestClient,
    user_headers: dict[str, str],
    clock: FixedClock,
    container: Container,
) -> None:
    url = f"{APPLICATIONS}/{tracked['id']}"
    submitted = user_client.post(f"{url}/submitted", headers=user_headers).json()
    assert submitted["status"] == "submitted"
    assert submitted["fee"]["paymentDeadline"].startswith("2026-10-25T06:00:00")
    assert submitted["feeUrgency"] == "ok"
    assert user_client.post(f"{url}/submitted", headers=user_headers).status_code == 409
    clock.advance(timedelta(hours=72))
    assert urgency(container, tracked) == "due_soon"
    clock.advance(timedelta(hours=49))
    assert urgency(container, tracked) == "overdue"


def test_a_fee_is_never_reported_paid_without_evidence(
    tracked: dict[str, object], user_client: TestClient, user_headers: dict[str, str]
) -> None:
    url = f"{APPLICATIONS}/{tracked['id']}/fee"
    refused = user_client.patch(url, json={"status": "paid"}, headers=user_headers)
    assert refused.status_code == 422
    assert refused.json()["detail"] == "evidence_required"
    unconfirmed = user_client.patch(url, json={"status": "unconfirmed", "method": "sms"}, headers=user_headers).json()
    assert unconfirmed["fee"]["status"] == "unconfirmed"
    paid = user_client.patch(url, json={"status": "paid", "transactionId": TRANSACTION}, headers=user_headers).json()
    assert paid["fee"]["status"] == "paid"
    assert paid["fee"]["confirmedAt"]
    assert paid["secretsPresent"] == ["transaction_id"]
    assert TRANSACTION not in str(paid)


def test_stages_are_recorded_with_dates_and_results_need_support(
    tracked: dict[str, object], user_client: TestClient, user_headers: dict[str, str]
) -> None:
    url = f"{APPLICATIONS}/{tracked['id']}/stages"
    written = {"stage": "written", "status": "scheduled", "on": "2026-12-05", "time": "10:00", "venue": "Dhaka College"}
    added = user_client.post(url, json=written, headers=user_headers).json()
    assert [s["stage"] for s in added["stages"]] == ["application", "written"]
    stage_id = next(s["id"] for s in added["stages"] if s["stage"] == "written")
    unsupported = {**written, "status": "passed", "source": "official_notice"}
    refused = user_client.put(f"{url}/{stage_id}", json=unsupported, headers=user_headers)
    assert refused.status_code == 422
    own_entry = {**written, "status": "passed", "source": "user_entry"}
    updated = user_client.put(f"{url}/{stage_id}", json=own_entry, headers=user_headers).json()
    assert next(s for s in updated["stages"] if s["id"] == stage_id)["status"] == "passed"
    official = {**own_entry, "source": "official_notice", "noticeUrl": "https://alljobs.teletalk.com.bd/result/1"}
    assert user_client.put(f"{url}/{stage_id}", json=official, headers=user_headers).status_code == 200
    removed = user_client.delete(f"{url}/{stage_id}", headers=user_headers).json()
    assert [s["stage"] for s in removed["stages"]] == ["application"]


def test_confirming_needs_evidence_and_the_applicant_copy_is_stored_and_served(
    tracked: dict[str, object], user_client: TestClient, user_headers: dict[str, str]
) -> None:
    url = f"{APPLICATIONS}/{tracked['id']}"
    user_client.post(f"{url}/submitted", headers=user_headers)
    assert user_client.post(f"{url}/confirmed", headers=user_headers).status_code == 422
    bad = user_client.post(f"{url}/copies", files={"file": ("x.txt", b"hello", "text/plain")}, headers=user_headers)
    assert bad.status_code == 422
    stored = user_client.post(f"{url}/copies", files={"file": ("copy.pdf", sample_pdf("Copy"), "application/pdf")}, headers=user_headers)
    copy = stored.json()["copies"][0]
    assert copy["contentType"] == "application/pdf"
    assert "key" not in copy
    assert user_client.get(copy["url"].replace("http://testserver", "")).content.startswith(b"%PDF-")
    assert user_client.post(f"{url}/confirmed", headers=user_headers).json()["status"] == "confirmed"
    removed = user_client.delete(f"{url}/copies/{copy['id']}", headers=user_headers).json()
    assert removed["copies"] == []


def test_portal_credentials_are_sealed_and_only_returned_when_asked(
    tracked: dict[str, object], user_client: TestClient, user_headers: dict[str, str], container: Container
) -> None:
    url = f"{APPLICATIONS}/{tracked['id']}"
    values = {"application_id": "APP-445566", "password": "Pa55word!x"}
    view = user_client.put(f"{url}/secrets", json={"values": values}, headers=user_headers).json()
    assert view["secretsPresent"] == ["application_id", "password"]
    assert "APP-445566" not in str(view)
    assert "Pa55word!x" not in str(view)
    stored = container.government.tracking.reveal_secrets("usr_demo", str(tracked["id"]))
    assert {k.value: v for k, v in stored.items()} == values
    revealed = user_client.post(f"{url}/secrets/reveal", headers=user_headers)
    assert revealed.headers["cache-control"] == "no-store"
    assert revealed.json()["values"] == values
    cleared = user_client.put(f"{url}/secrets", json={"values": {"password": ""}}, headers=user_headers).json()
    assert cleared["secretsPresent"] == ["application_id"]


def test_the_guide_keeps_submission_and_verification_with_the_user(
    tracked: dict[str, object], user_client: TestClient, user_headers: dict[str, str]
) -> None:
    steps = user_client.get(f"{APPLICATIONS}/{tracked['id']}/guide", headers=user_headers).json()
    actors = {step["kind"]: step["actor"] for step in steps}
    assert actors["submit_form"] == "user"
    assert actors["complete_verification"] == "user"
    assert actors["pay_fee"] == "user"
    assert actors["check_eligibility"] == "system"
    assert next(s for s in steps if s["kind"] == "open_official_site")["link"] == "https://alljobs.teletalk.com.bd/apply/1"
    assert next(s for s in steps if s["kind"] == "check_eligibility")["done"] is True


def test_upcoming_lists_closing_payment_and_stage_dates_with_holiday_notes(
    tracked: dict[str, object], user_client: TestClient, user_headers: dict[str, str]
) -> None:
    url = f"{APPLICATIONS}/{tracked['id']}"
    user_client.post(f"{url}/stages", json={"stage": "viva", "status": "scheduled", "on": "2026-12-16"}, headers=user_headers)
    items = user_client.get("/v1/government/upcoming", headers=user_headers).json()
    assert [(i["subject"], i["on"]) for i in items] == [("application_close", "2026-11-12"), ("stage", "2026-12-16")]
    assert items[1]["note"]["kind"] == "holiday"
    assert items[1]["note"]["holidayName"] == "Victory Day"
    user_client.post(f"{url}/submitted", headers=user_headers)
    subjects = [i["subject"] for i in user_client.get("/v1/government/upcoming", headers=user_headers).json()]
    assert subjects == ["fee_payment", "stage"]


def test_withdrawing_removes_the_application_from_the_list(
    tracked: dict[str, object], user_client: TestClient, user_headers: dict[str, str]
) -> None:
    assert user_client.delete(f"{APPLICATIONS}/{tracked['id']}", headers=user_headers).status_code == 204
    assert user_client.get(APPLICATIONS, headers=user_headers).json() == []
    assert user_client.get(f"{APPLICATIONS}/{tracked['id']}", headers=user_headers).status_code == 404
