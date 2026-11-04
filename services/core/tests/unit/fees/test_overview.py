from datetime import UTC, datetime

from fastapi.testclient import TestClient

from careerpilot.fees.adapters.in_memory import InMemoryFeeRecords
from careerpilot.fees.context import FeesContext
from careerpilot.fees.service import FeesServices, build_fees
from careerpilot.government.models import FeeRecord, GovApplicationView
from careerpilot.platform.clock import FixedClock, SequentialIdGenerator
from careerpilot.platform.config import load_settings
from careerpilot.platform.enums import FeeStatus, FeeUrgency, GovApplicationStatus
from tests.unit.fees.conftest import BASE, act, deadline_in, make_payment, rule_body

NOW = datetime(2026, 10, 20, 6, 0, tzinfo=UTC)


def government_view(
    fee: FeeRecord, urgency: FeeUrgency, status: GovApplicationStatus = GovApplicationStatus.SUBMITTED
) -> GovApplicationView:
    return GovApplicationView(
        id="gap_1",
        circular_id="c1",
        circular_title="Assistant Officer",
        authority="Board",
        circular_version=1,
        post_ids=[],
        post_titles=[],
        status=status,
        fee=fee,
        fee_urgency=urgency,
        stages=[],
        copies=[],
        secrets_present=[],
    )


def services_with(views: list[GovApplicationView]) -> FeesServices:
    context = FeesContext(load_settings().fees, FixedClock(NOW), SequentialIdGenerator(), InMemoryFeeRecords(), lambda _: views)
    return build_fees(context)


def test_government_fees_are_reused_not_duplicated() -> None:
    open_fee = FeeRecord(amount=300, currency="BDT", status=FeeStatus.UNCONFIRMED, payment_deadline=NOW)
    services = services_with(
        [
            government_view(open_fee, FeeUrgency.DUE_SOON),
            government_view(FeeRecord(status=FeeStatus.NOT_REQUIRED), FeeUrgency.NONE),
            government_view(open_fee, FeeUrgency.NONE, GovApplicationStatus.WITHDRAWN),
        ]
    )
    overview = services.overview.build("u1")
    assert [(line.source.value, line.status.value, line.kind.value) for line in overview.lines] == [
        ("government", "uncertain", "government")
    ]
    assert [r.kind.value for r in overview.reminders] == ["confirm_outcome"]
    assert overview.totals[0].uncertain == 300


def test_overview_lists_rules_without_payment_and_totals_by_currency(client: TestClient, clock: FixedClock) -> None:
    client.post(f"{BASE}/rules", json=rule_body(deadline=deadline_in(clock, days=1)))
    paid_rule = client.post(f"{BASE}/rules", json=rule_body(title="Second", amount=200, currency="USD")).json()["rule"]
    payment = client.post(f"{BASE}/rules/{paid_rule['id']}/payments").json()["payment"]
    act(client, payment["id"], action="confirm_paid", receipt={"kind": "receipt_number", "reference": "R1"})
    make_payment(client, deadline=deadline_in(clock, days=-2))
    overview = client.get(f"{BASE}/overview").json()
    assert {line["source"] for line in overview["lines"]} == {"fee_rule", "payment"}
    assert overview["lines"][0]["urgency"] == "overdue"
    assert {t["currency"]: (t["due"], t["paid"]) for t in overview["totals"]} == {"BDT": (1200, 0), "USD": (0, 200)}
    assert sorted(r["kind"] for r in overview["reminders"]) == ["due_soon", "overdue"]


def test_rule_crud_and_reference(client: TestClient) -> None:
    rule = client.post(f"{BASE}/rules", json=rule_body()).json()["rule"]
    changed = client.put(f"{BASE}/rules/{rule['id']}", json=rule_body(amount=650)).json()
    assert changed["rule"]["amount"] == 650
    assert client.delete(f"{BASE}/rules/{rule['id']}").status_code == 204
    assert client.get(f"{BASE}/rules").json() == []
    assert "BDT" in client.get(f"{BASE}/reference").json()["currencies"]
