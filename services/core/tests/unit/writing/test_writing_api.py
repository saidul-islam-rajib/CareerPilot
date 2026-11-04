import json

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select

from careerpilot.api.user_app import create_user_app
from careerpilot.bootstrap import Container, ContainerOverrides, build_container
from careerpilot.platform.clock import FixedClock, SequentialIdGenerator
from careerpilot.platform.config import PersistenceMode
from careerpilot.platform.email_delivery import InMemoryEmailSender
from careerpilot.platform.files import InMemoryFileStorage
from careerpilot.platform.persistence import SQLITE_MEMORY_URL, Base, create_database
from careerpilot.testing import load_sample_data, sample_database_repositories, sample_settings
from careerpilot.writing.adapters.sql import WritingDraftRow
from careerpilot.writing.enums import WritingKind
from careerpilot.writing.service import GenerateInput
from tests.unit.conftest import CLIENT, TEST_SECRET, FakeHasher
from tests.unit.writing.conftest import APPROVAL, OPPORTUNITY, OSLO_APPROVAL, USER, FakeWriter

PASSWORD = "admin@sober.com"
SECRET_WORDS = ("apiKey", "api_key", "ANTHROPIC", "sk-ant")


def client_for(container: Container) -> TestClient:
    client = TestClient(create_user_app(container))
    token = container.auth.sign_in("admin@sober.com", PASSWORD, CLIENT).access_token
    client.headers["Authorization"] = f"Bearer {token}"
    return client


def test_status_endpoint_tells_the_apps_whether_ai_is_configured(container: Container, ai_container: Container) -> None:
    plain = client_for(container).get("/v1/writing/status").json()
    assert plain["aiConfigured"] is False
    assert plain["provider"] == "template"
    assert {k["kind"]: k["available"] for k in plain["kinds"]}["essay"] is False
    ai = client_for(ai_container).get("/v1/writing/status").json()
    assert ai["aiConfigured"] is True
    assert ai["model"] == "fake-model"
    assert not any(word in json.dumps(ai) for word in SECRET_WORDS)


def test_requires_sign_in(container: Container) -> None:
    anonymous = TestClient(create_user_app(container))
    assert anonymous.get("/v1/writing/status").status_code == 401
    assert anonymous.get("/v1/writing/drafts").status_code == 401


def test_generate_list_edit_attach_and_remove_over_http(container: Container) -> None:
    client = client_for(container)
    created = client.post(
        "/v1/writing/drafts", json={"kind": "cover_letter", "opportunityId": OPPORTUNITY, "tone": "friendly", "maxWords": 200}
    )
    assert created.status_code == 200
    draft = created.json()
    assert draft["source"] == "template"
    assert draft["status"] == "ready"
    assert draft["version"] == 1
    assert "userId" not in draft
    listed = client.get("/v1/writing/drafts", params={"opportunityId": OPPORTUNITY, "kind": "cover_letter"}).json()
    assert [d["id"] for d in listed] == [draft["id"]]
    assert client.get("/v1/writing/drafts", params={"opportunityId": "opp_other"}).json() == []
    edited = client.put(f"/v1/writing/drafts/{draft['id']}", json={"text": "Dear Kite Commerce, Northwind Labs."}).json()
    assert edited["version"] == 2
    assert edited["status"] == "needs_fixes"
    assert edited["issues"][0]["kind"] == "other_employer"
    blocked = client.post(f"/v1/writing/drafts/{edited['id']}/attach", json={"approvalId": APPROVAL})
    assert blocked.status_code == 422
    assert blocked.json()["detail"] == "has_issues"
    attached = client.post(f"/v1/writing/drafts/{draft['id']}/attach", json={"approvalId": APPROVAL}).json()
    assert attached["attachedApprovalIds"] == [APPROVAL]
    approval = client.get(f"/v1/approvals/{APPROVAL}").json()
    assert approval["materials"]["writing"][0]["draftId"] == draft["id"]
    assert approval["materials"]["coverLetter"] == draft["text"]
    detached = client.post(f"/v1/writing/drafts/{draft['id']}/detach", json={"approvalId": APPROVAL}).json()
    assert detached["attachedApprovalIds"] == []
    assert client.delete(f"/v1/writing/drafts/{edited['id']}").status_code == 204
    assert client.get(f"/v1/writing/drafts/{edited['id']}").status_code == 404
    assert client.post(f"/v1/writing/drafts/{draft['id']}/check").json()["status"] == "ready"


def test_errors_use_codes_the_apps_can_translate(container: Container) -> None:
    client = client_for(container)
    essay = client.post("/v1/writing/drafts", json={"kind": "essay", "opportunityId": OPPORTUNITY})
    assert essay.status_code == 503
    assert essay.json()["detail"] == "ai_not_configured"
    assert client.post("/v1/writing/drafts", json={"kind": "poem", "opportunityId": OPPORTUNITY}).status_code == 422
    draft = client.post("/v1/writing/drafts", json={"kind": "cover_letter", "opportunityId": OPPORTUNITY}).json()
    mismatch = client.post(f"/v1/writing/drafts/{draft['id']}/attach", json={"approvalId": OSLO_APPROVAL})
    assert (mismatch.status_code, mismatch.json()["detail"]) == (409, "opportunity_mismatch")
    assert client.put(f"/v1/writing/drafts/{draft['id']}", json={"text": " "}).status_code == 422


def test_strip_flagged_over_http(ai_container: Container, writer: FakeWriter) -> None:
    writer.text = "Dear Northwind Labs hiring team, I build React interfaces.\n\nI admire Kite Commerce."
    client = client_for(ai_container)
    draft = client.post("/v1/writing/drafts", json={"kind": "statement", "opportunityId": OPPORTUNITY}).json()
    assert draft["source"] == "ai"
    assert draft["status"] == "needs_fixes"
    cleaned = client.post(f"/v1/writing/drafts/{draft['id']}/strip-flagged").json()
    assert cleaned["status"] == "ready"
    assert "Kite" not in cleaned["text"]


def test_drafts_survive_in_the_database_and_deletes_are_soft(clock: FixedClock, outbox: InMemoryEmailSender) -> None:
    settings = sample_settings()
    settings = settings.model_copy(update={"persistence": settings.persistence.model_copy(update={"mode": PersistenceMode.DATABASE})})
    database = create_database(SQLITE_MEMORY_URL, clock)
    Base.metadata.create_all(database.engine)
    stored = build_container(
        ContainerOverrides(
            settings=settings,
            clock=clock,
            ids=SequentialIdGenerator(),
            hasher=FakeHasher(),
            token_secret=TEST_SECRET,
            file_storage=InMemoryFileStorage(),
            database=database,
            repositories=sample_database_repositories(load_sample_data(clock.now()), database),
            email_sender=outbox,
        )
    )
    first = stored.writing.generate(USER, GenerateInput(WritingKind.COVER_LETTER, OPPORTUNITY))
    assert stored.writing.get(USER, first.id).text == first.text
    assert stored.writing.get(USER, first.id).user_id == USER
    stored.writing.attach(USER, first.id, APPROVAL)
    assert stored.writing.get(USER, first.id).attached_approval_ids == [APPROVAL]
    stored.writing.remove(USER, first.id)
    assert stored.writing.drafts(USER) == []
    with database.unit_of_work() as session:
        assert session.scalar(select(func.count()).select_from(WritingDraftRow)) == 1
        row = session.scalars(select(WritingDraftRow)).one()
        assert row.deleted_at is not None
        assert row.created_by


@pytest.mark.parametrize("path", ["/v1/writing/drafts/wrt_missing", "/v1/writing/drafts/wrt_missing/check"])
def test_unknown_drafts_are_not_found(container: Container, path: str) -> None:
    client = client_for(container)
    response = client.get(path) if not path.endswith("check") else client.post(path)
    assert response.status_code == 404
