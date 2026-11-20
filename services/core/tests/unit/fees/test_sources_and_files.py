from fastapi.testclient import TestClient

from careerpilot.bootstrap import Container
from careerpilot.platform.files import sample_pdf
from tests.unit.fees.conftest import BASE, make_payment

OPPORTUNITY = "opp_6"
ACADEMIC = "/v1/academic"


def describe(container: Container, text: str) -> None:
    store = container.recommendations._ctx.opportunities  # pyright: ignore[reportPrivateUsage]
    found = store.get(OPPORTUNITY)
    assert found is not None
    store.save(found.model_copy(update={"description": text}))


def test_rule_is_read_from_the_posting_text(client: TestClient, container: Container) -> None:
    describe(container, "Apply now. Application fee: BDT 500 payable at the bank.")
    created = client.post(f"{BASE}/rules/from-opportunity/{OPPORTUNITY}")
    assert created.status_code == 200, created.text
    rule = created.json()["rule"]
    assert (rule["amount"], rule["currency"], rule["opportunityId"]) == (500, "BDT", OPPORTUNITY)
    again = client.post(f"{BASE}/rules/from-opportunity/{OPPORTUNITY}")
    assert again.json()["rule"]["id"] == rule["id"]


def test_no_stated_fee_is_refused_and_nothing_is_invented(client: TestClient, container: Container) -> None:
    describe(container, "Apply by email. Competitive pay.")
    assert client.post(f"{BASE}/rules/from-opportunity/{OPPORTUNITY}").status_code == 422
    assert client.post(f"{BASE}/rules/from-opportunity/missing").status_code == 404


def test_rule_from_a_program_uses_its_fee(client: TestClient) -> None:
    program = client.post(
        f"{ACADEMIC}/programs",
        json={
            "kind": "taught_masters",
            "title": "MSc Data Science",
            "university": "Northern University",
            "fee": {"amount": 75, "currency": "USD", "source": "official"},
        },
    )
    assert program.status_code == 200, program.text
    created = client.post(f"{BASE}/rules/from-program/{program.json()['id']}")
    assert created.status_code == 200, created.text
    assert (created.json()["rule"]["amount"], created.json()["rule"]["currency"]) == (75, "USD")
    bare = client.post(f"{ACADEMIC}/programs", json={"kind": "taught_masters", "title": "MSc B", "university": "Other"})
    assert client.post(f"{BASE}/rules/from-program/{bare.json()['id']}").status_code == 422


def test_receipt_file_is_stored_with_a_hash_and_link(client: TestClient) -> None:
    payment = make_payment(client)["payment"]
    uploaded = client.post(
        f"{BASE}/payments/{payment['id']}/receipt-files", files={"file": ("slip.pdf", sample_pdf("Slip"), "application/pdf")}
    )
    assert uploaded.status_code == 200, uploaded.text
    [receipt] = uploaded.json()["payment"]["receipts"]
    assert receipt["kind"] == "uploaded_file"
    assert len(receipt["sha256"]) == 64
    assert receipt["url"]


def test_receipt_file_rejects_wrong_types_and_empty_files(client: TestClient) -> None:
    payment = make_payment(client)["payment"]
    url = f"{BASE}/payments/{payment['id']}/receipt-files"
    assert client.post(url, files={"file": ("a.txt", b"hello", "text/plain")}).status_code == 422
    assert client.post(url, files={"file": ("a.pdf", b"", "application/pdf")}).status_code == 422
