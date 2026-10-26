import pytest
from fastapi.testclient import TestClient

from careerpilot.api.user_app import create_user_app
from careerpilot.bootstrap import Container
from careerpilot.candidate.answer_rules import detect_topic, group_key, normalise
from careerpilot.candidate.services.answers import AnswerDraft
from careerpilot.platform.enums import AnswerSource, AnswerTopic, ApprovalState
from careerpilot.platform.errors import DomainError, ErrorCode
from tests.unit.conftest import DEMO_USER

OSLO = "apr_oslo"


def failure(action: object) -> tuple[ErrorCode, str | None]:
    with pytest.raises(DomainError) as caught:
        assert callable(action)
        action()
    return caught.value.code, caught.value.detail


def test_questions_with_the_same_meaning_share_a_group(container: Container) -> None:
    keywords = container.settings.answers.keywords()
    assert normalise("  What's your NOTICE-period? ") == "what s your notice period"
    assert detect_topic("Notice period", keywords) is detect_topic("What is your notice period?", keywords) is AnswerTopic.NOTICE_PERIOD
    assert detect_topic("Are you authorized to work in Norway without sponsorship?", keywords) is AnswerTopic.WORK_AUTHORIZATION
    assert detect_topic("Why do you want to join us?", keywords) is AnswerTopic.OTHER
    assert group_key(AnswerTopic.OTHER, "Why do you want to join us?") == "other:why do you want to join us"


def test_bank_counts_questions_and_highlights_blocking_ones(container: Container) -> None:
    bank = container.answers.bank(DEMO_USER)
    notice = next(g for g in bank.groups if g.key == "notice_period")
    assert (notice.count, notice.last_answer, notice.saved_answer_id) == (5, "30 days", "ans_notice")
    first = bank.groups[0]
    assert (first.topic, first.needs_answer, first.question) == (AnswerTopic.RELOCATION, True, "Are you willing to relocate to Oslo?")
    assert [a.id for a in bank.saved] == ["ans_notice"]
    assert failure(lambda: container.approvals.approve(DEMO_USER, OSLO)) == (ErrorCode.VALIDATION, "unanswered_questions")


def test_saving_an_answer_fills_only_blank_questions(container: Container) -> None:
    bank = container.answers.save(DEMO_USER, AnswerDraft(AnswerTopic.RELOCATION, " Are you willing to relocate? ", "Yes, within Europe"))
    assert next(g for g in bank.groups if g.topic is AnswerTopic.RELOCATION).needs_answer is False
    answers = {a.id: a for a in container.approvals.get(DEMO_USER, OSLO).materials.answers}
    assert (answers["q_relocate"].answer, answers["q_relocate"].source) == ("Yes, within Europe", AnswerSource.SAVED)
    assert answers["q_start"].source is AnswerSource.USER
    sponsorship = container.answers.save(DEMO_USER, AnswerDraft(AnswerTopic.SPONSORSHIP, "Do you need a visa?", "No"))
    assert next(a for a in container.approvals.get(DEMO_USER, OSLO).materials.answers if a.id == "q_permit").answer == "Yes"
    assert len(sponsorship.saved) == 3
    assert container.approvals.approve(DEMO_USER, OSLO).state is ApprovalState.APPROVED


def test_edit_remove_restore_and_limits(container: Container) -> None:
    saved = container.answers.save(DEMO_USER, AnswerDraft(AnswerTopic.NOTICE_PERIOD, "Notice period?", "60 days"))
    assert [(a.id, a.answer) for a in saved.saved] == [("ans_notice", "60 days")]
    edited = container.answers.save(
        DEMO_USER, AnswerDraft(AnswerTopic.NOTICE_PERIOD, "What is your notice period?", "45 days"), "ans_notice"
    )
    assert edited.saved[0].answer == "45 days"
    assert container.answers.remove(DEMO_USER, "ans_notice").saved == []
    assert [a.id for a in container.answers.restore(DEMO_USER, "ans_notice").saved] == ["ans_notice"]
    assert failure(lambda: container.answers.save(DEMO_USER, AnswerDraft(AnswerTopic.OTHER, "   ", "x"))) == (
        ErrorCode.VALIDATION,
        "question",
    )
    assert failure(lambda: container.answers.save(DEMO_USER, AnswerDraft(AnswerTopic.OTHER, "Q", " "))) == (ErrorCode.VALIDATION, "answer")
    assert failure(lambda: container.answers.remove(DEMO_USER, "ans_missing"))[0] is ErrorCode.NOT_FOUND


def test_approval_answers_can_be_saved_for_reuse(container: Container) -> None:
    container.approvals.update_answer(DEMO_USER, OSLO, "q_relocate", "Yes", save_for_reuse=True)
    saved = next(a for a in container.answers.bank(DEMO_USER).saved if a.topic is AnswerTopic.RELOCATION)
    assert (saved.question, saved.answer) == ("Are you willing to relocate to Oslo?", "Yes")


def test_answer_endpoints(container: Container) -> None:
    client = TestClient(create_user_app(container))
    token = client.post("/v1/auth/sign-in", json={"email": "admin@sober.com", "password": "admin@sober.com"}).json()["accessToken"]
    headers = {"Authorization": f"Bearer {token}"}
    bank = client.get("/v1/answers", headers=headers).json()
    assert bank["groups"][0]["needsAnswer"] is True
    added = client.post(
        "/v1/answers", headers=headers, json={"topic": "relocation", "question": "Can you relocate?", "answer": "Yes"}
    ).json()
    new_id = next(a["id"] for a in added["saved"] if a["topic"] == "relocation")
    assert (
        client.put(
            f"/v1/answers/{new_id}", headers=headers, json={"topic": "relocation", "question": "Can you relocate?", "answer": "No"}
        ).status_code
        == 200
    )
    assert new_id not in {a["id"] for a in client.delete(f"/v1/answers/{new_id}", headers=headers).json()["saved"]}
    assert new_id in {a["id"] for a in client.post(f"/v1/answers/{new_id}/restore", headers=headers).json()["saved"]}
    saved = client.put("/v1/approvals/apr_frontend/answers/q_notice", headers=headers, json={"answer": "15 days", "saveForReuse": True})
    assert saved.status_code == 200
    assert (
        next(a for a in client.get("/v1/answers", headers=headers).json()["saved"] if a["topic"] == "notice_period")["answer"] == "15 days"
    )
    assert client.get("/v1/config").json()["answers"]["topicKeywords"][0]["topic"] == "work_authorization"
