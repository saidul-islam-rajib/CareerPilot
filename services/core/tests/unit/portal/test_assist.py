import pytest
from fastapi.testclient import TestClient

from careerpilot.api.user_app import create_user_app
from careerpilot.bootstrap import Container
from careerpilot.candidate.services.answers import AnswerDraft
from careerpilot.platform.clock import FixedClock
from careerpilot.platform.enums import AnswerTopic, SubmissionStatus
from careerpilot.platform.errors import DomainError
from careerpilot.portal.enums import HostPolicy
from careerpilot.portal.models import CompleteInput, HostInput
from careerpilot.portal.testing import FakeDriver
from tests.unit.conftest import DEMO_USER
from tests.unit.portal.conftest import ACCOUNT_EMAIL, HOST
from tests.unit.portal.test_runner import build, prepare, simple_site

BASE = "/v1/portal/applications"


def stopped_application(clock: FixedClock) -> tuple[Container, str]:
    driver: FakeDriver = simple_site()
    container, _ = build(clock, driver, live=False)
    application_id = prepare(container)
    container.portal.runner.run(DEMO_USER, application_id)
    return container, application_id


def link(key: str, name: str) -> str:
    return f"https://files.test/{key}?name={name}"


def test_fill_plan_holds_only_verified_facts_and_saved_answers(clock: FixedClock) -> None:
    container, application_id = stopped_application(clock)
    plan = container.portal.assist.plan(DEMO_USER, application_id, link)
    assert plan.host == HOST
    assert plan.assist_allowed is True
    assert plan.account_email == ACCOUNT_EMAIL
    assert plan.has_password is True
    assert {f.fact for f in plan.facts} <= {
        "full_name",
        "first_name",
        "last_name",
        "email",
        "phone",
        "location",
        "country",
        "headline",
        "summary",
    }
    assert all(f.value for f in plan.facts)
    assert {a.label for a in plan.answers} >= {"Years of experience", "Do you require visa sponsorship?"}
    assert "thank you for applying" in plan.confirmation_phrases
    assert plan.captcha_selectors
    assert "certify" in plan.skip_terms


def test_demographic_and_declaration_answers_are_not_offered(clock: FixedClock) -> None:
    container, application_id = stopped_application(clock)
    container.answers.save(DEMO_USER, AnswerDraft(AnswerTopic.OTHER, "What is your gender?", "Male"))
    container.answers.save(DEMO_USER, AnswerDraft(AnswerTopic.OTHER, "I certify the information is true", "Yes"))
    labels = {a.label for a in container.portal.assist.plan(DEMO_USER, application_id, link).answers}
    assert "What is your gender?" not in labels and "I certify the information is true" not in labels


def test_blocked_host_is_not_assisted(clock: FixedClock) -> None:
    container, application_id = stopped_application(clock)
    container.portal.hosts.decide(HOST, HostInput(policy=HostPolicy.BLOCKED))
    plan = container.portal.assist.plan(DEMO_USER, application_id, link)
    assert plan.assist_allowed is False and plan.host_policy is HostPolicy.BLOCKED


def test_password_is_generated_once_stored_and_returned_on_request(clock: FixedClock) -> None:
    container, application_id = stopped_application(clock)
    first = container.portal.assist.password(DEMO_USER, application_id)
    second = container.portal.assist.password(DEMO_USER, application_id)
    assert first.email == ACCOUNT_EMAIL and first.password == second.password
    assert len(container.portal.accounts.views(DEMO_USER)) == 1
    assert first.password not in container.portal.assist.plan(DEMO_USER, application_id, link).model_dump_json()


def test_unknown_application_has_no_plan(clock: FixedClock) -> None:
    container, _ = stopped_application(clock)
    with pytest.raises(DomainError):
        container.portal.assist.plan(DEMO_USER, "app_missing", link)


def test_evidence_link_needs_a_stored_screenshot(clock: FixedClock) -> None:
    container, application_id = stopped_application(clock)
    attempt = container.portal.service.attempt(DEMO_USER, application_id)
    if attempt.evidence_key:
        assert container.portal.assist.evidence_link(DEMO_USER, application_id, link).url.endswith("name=evidence.png")
    else:
        with pytest.raises(DomainError):
            container.portal.assist.evidence_link(DEMO_USER, application_id, link)


def test_complete_records_the_final_url_and_page_text_as_evidence(clock: FixedClock) -> None:
    container, application_id = stopped_application(clock)
    body = CompleteInput(final_url="https://jobs.acme.test/done", confirmation_text="Thank you for applying")
    record = container.portal.service.complete(DEMO_USER, application_id, body)
    assert record.submission_status is SubmissionStatus.SUBMITTED_AWAITING_CONFIRMATION
    assert record.evidence[-1].url == "https://jobs.acme.test/done"
    assert "Thank you for applying" in record.evidence[-1].text


def test_routes_serve_plan_password_and_complete(clock: FixedClock) -> None:
    container, application_id = stopped_application(clock)
    app = TestClient(create_user_app(container))
    token = app.post("/v1/auth/sign-in", json={"email": "admin@sober.com", "password": "admin@sober.com"}).json()["accessToken"]
    app.headers["Authorization"] = f"Bearer {token}"
    plan = app.get(f"{BASE}/{application_id}/fill-plan").json()
    assert plan["officialUrl"] and plan["assistAllowed"] is True and "password" not in plan
    assert app.get(f"{BASE}/{application_id}/fill-plan/password").json()["email"] == ACCOUNT_EMAIL
    assert app.get(f"{BASE}/app_missing/fill-plan").status_code == 404
    done = app.post(f"{BASE}/{application_id}/complete", json={"finalUrl": "https://jobs.acme.test/done", "confirmationText": "ok"})
    assert done.status_code == 200
    assert app.post(f"{BASE}/{application_id}/complete").status_code in {200, 422}
