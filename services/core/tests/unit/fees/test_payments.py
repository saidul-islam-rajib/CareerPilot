from fastapi.testclient import TestClient

from careerpilot.platform.clock import FixedClock
from tests.unit.fees.conftest import BASE, act, deadline_in, make_payment, payment_body, rule_body

RECEIPT = {"kind": "confirmation_message", "reference": "TrxID 9XK21"}


def test_new_payment_is_due_and_unverified(client: TestClient) -> None:
    created = make_payment(client)
    assert created["payment"]["status"] == "due"
    assert created["warnings"] == ["unverified_payee"]
    assert created["payment"].get("paidAt") is None


def test_paid_requires_evidence(client: TestClient) -> None:
    payment = make_payment(client)["payment"]
    refused = act(client, payment["id"], action="confirm_paid")
    assert refused.status_code == 422
    accepted = act(client, payment["id"], action="confirm_paid", receipt=RECEIPT)
    assert accepted.json()["payment"]["status"] == "paid"
    assert accepted.json()["payment"]["paidAt"] is not None


def test_transaction_id_counts_as_evidence_and_is_unique(client: TestClient) -> None:
    first = make_payment(client, transactionId="TX-1")["payment"]
    assert act(client, first["id"], action="confirm_paid").json()["payment"]["status"] == "paid"
    assert client.post(f"{BASE}/payments", json=payment_body(transactionId="tx-1")).status_code == 409


def test_uncertain_payment_needs_user_confirmation_and_never_assumes(client: TestClient) -> None:
    payment = make_payment(client)["payment"]
    marked = act(client, payment["id"], action="mark_uncertain", note="SMS never arrived").json()
    assert marked["payment"]["status"] == "uncertain"
    assert marked["guidance"] == ["verify_with_payee", "do_not_pay_again", "add_receipt"]
    assert act(client, payment["id"], action="mark_refunded").status_code == 422
    back = act(client, payment["id"], action="confirm_not_paid").json()
    assert back["payment"]["status"] == "due"
    assert [event["status"] for event in back["payment"]["history"]] == ["due", "uncertain", "due"]


def test_invalid_transitions_are_refused(client: TestClient) -> None:
    payment = make_payment(client)["payment"]
    assert act(client, payment["id"], action="confirm_not_paid").status_code == 422
    act(client, payment["id"], action="mark_failed")
    assert act(client, payment["id"], action="mark_waived").status_code == 422


def test_refund_needs_a_note(client: TestClient) -> None:
    payment = make_payment(client)["payment"]
    act(client, payment["id"], action="confirm_paid", receipt=RECEIPT)
    assert act(client, payment["id"], action="mark_refunded").status_code == 422
    refunded = act(client, payment["id"], action="mark_refunded", note="Refund promised in 7 days")
    assert refunded.json()["payment"]["status"] == "refunded"


def test_second_paid_payment_for_one_rule_is_flagged_as_possible_duplicate(client: TestClient) -> None:
    rule = client.post(f"{BASE}/rules", json=rule_body()).json()["rule"]
    first = client.post(f"{BASE}/rules/{rule['id']}/payments").json()["payment"]
    second = client.post(f"{BASE}/rules/{rule['id']}/payments").json()["payment"]
    act(client, first["id"], action="confirm_paid", receipt=RECEIPT)
    flagged = act(client, second["id"], action="confirm_paid", receipt={"kind": "receipt_number", "reference": "R-2"}).json()
    assert "possible_duplicate" in flagged["warnings"]
    assert flagged["guidance"] == ["check_duplicate", "request_refund"]


def test_paid_without_receipt_warns_and_receipt_can_be_added_and_removed(client: TestClient) -> None:
    payment = make_payment(client, transactionId="TX-9")["payment"]
    paid = act(client, payment["id"], action="confirm_paid").json()
    assert "no_receipt" in paid["warnings"]
    added = client.post(f"{BASE}/payments/{payment['id']}/receipts", json=RECEIPT).json()
    assert added["warnings"] == []
    receipt_id = added["payment"]["receipts"][0]["id"]
    removed = client.delete(f"{BASE}/payments/{payment['id']}/receipts/{receipt_id}").json()
    assert removed["payment"]["receipts"] == []


def test_urgency_follows_deadline(client: TestClient, clock: FixedClock) -> None:
    soon = make_payment(client, deadline=deadline_in(clock, days=1))
    late = make_payment(client, title="Late", deadline=deadline_in(clock, days=-1))
    far = make_payment(client, title="Far", deadline=deadline_in(clock, days=30))
    assert [v["urgency"] for v in (soon, late, far)] == ["due_soon", "overdue", "ok"]


def test_unsupported_currency_and_unknown_rule_are_refused(client: TestClient) -> None:
    assert client.post(f"{BASE}/payments", json=payment_body(currency="XXX")).status_code == 422
    assert client.post(f"{BASE}/payments", json=payment_body(ruleId="nope")).status_code == 404


def test_removed_payments_disappear(client: TestClient) -> None:
    payment = make_payment(client)["payment"]
    assert client.delete(f"{BASE}/payments/{payment['id']}").status_code == 204
    assert client.get(f"{BASE}/payments/{payment['id']}").status_code == 404
    assert client.get(f"{BASE}/payments").json() == []


def test_update_keeps_status_and_changes_amount(client: TestClient) -> None:
    payment = make_payment(client)["payment"]
    changed = client.put(f"{BASE}/payments/{payment['id']}", json=payment_body(amount=900, payeeVerified=True)).json()
    assert changed["payment"]["amount"] == 900
    assert changed["warnings"] == []
