from contextlib import nullcontext

import pytest

from careerpilot.bootstrap import Container, ContainerOverrides, build_container
from careerpilot.candidate.models import SubmissionWindow
from careerpilot.candidate.services.answers import AnswerDraft
from careerpilot.platform.clock import FixedClock, SequentialIdGenerator
from careerpilot.platform.email_delivery import InMemoryEmailSender
from careerpilot.platform.enums import AnswerTopic, SubmissionStatus, SubmissionWindowKind
from careerpilot.platform.files import InMemoryFileStorage
from careerpilot.portal.enums import AttemptState, FieldKind, HostPolicy, StopReason
from careerpilot.portal.models import AutopilotInput, HostInput, ResumeAnswer, ResumeInput
from careerpilot.portal.testing import FakeDriver, FakePage
from careerpilot.testing import load_sample_data, sample_repositories, sample_settings
from tests.unit.candidate.test_submission import PORTAL_OPPORTUNITY, approve
from tests.unit.conftest import DEMO_USER, TEST_SECRET, FakeHasher
from tests.unit.portal.conftest import ACCOUNT_EMAIL, HOST, JOB_URL, application_site, field

ENABLE = AutopilotInput(
    acknowledged=True,
    allow_account_creation=True,
    account_email=ACCOUNT_EMAIL,
    accept_terms=True,
    accept_privacy=True,
    allow_email_verification=False,
)


def build(clock: FixedClock, driver: FakeDriver, live: bool) -> tuple[Container, InMemoryEmailSender]:
    sender = InMemoryEmailSender()
    overrides = ContainerOverrides(
        settings=sample_settings(),
        repositories=sample_repositories(load_sample_data(clock.now())),
        clock=clock,
        ids=SequentialIdGenerator(),
        hasher=FakeHasher(),
        token_secret=TEST_SECRET,
        file_storage=InMemoryFileStorage(),
        email_sender=sender,
        browser=lambda: nullcontext(driver),
        real_applications=live,
    )
    container = build_container(overrides)
    container.preferences.update_submission_window(DEMO_USER, SubmissionWindow(kind=SubmissionWindowKind.AS_SOON_AS_READY))
    return container, sender


def simple_site() -> FakeDriver:
    driver = application_site()
    driver.pages["register"].buttons = {"Create account": "step1"}
    driver.urls[JOB_URL] = "job"
    return driver


def point_at_site(container: Container) -> None:
    opportunities = container.recommendations._ctx.opportunities  # pyright: ignore[reportPrivateUsage]
    current = opportunities.get(PORTAL_OPPORTUNITY)
    assert current is not None
    opportunities.save(current.model_copy(update={"source": current.source.model_copy(update={"url": JOB_URL})}))


def prepare(container: Container, allowed: bool = True, answers: bool = True) -> str:
    point_at_site(container)
    application_id = approve(container, PORTAL_OPPORTUNITY)
    container.portal.service.enable(DEMO_USER, ENABLE)
    if allowed:
        container.portal.hosts.decide(HOST, HostInput(policy=HostPolicy.ALLOWED))
    if answers:
        container.answers.save(DEMO_USER, AnswerDraft(AnswerTopic.EXPERIENCE, "Years of experience", "5"))
        container.answers.save(DEMO_USER, AnswerDraft(AnswerTopic.SPONSORSHIP, "Do you require visa sponsorship?", "No"))
    return application_id


def status_of(container: Container, application_id: str) -> SubmissionStatus:
    return container.applications.get(DEMO_USER, application_id).submission_status


@pytest.fixture
def driver() -> FakeDriver:
    return simple_site()


def test_portal_jobs_stay_manual_until_autopilot_is_on(clock: FixedClock, driver: FakeDriver) -> None:
    container, _ = build(clock, driver, live=True)
    application_id = approve(container, PORTAL_OPPORTUNITY)
    assert container.portal.runner.due() == []
    assert container.submissions.submit(DEMO_USER, application_id).status is SubmissionStatus.MANUAL_ACTION_REQUIRED
    assert driver.opened == []


def test_autopilot_must_be_acknowledged(clock: FixedClock, driver: FakeDriver) -> None:
    container, _ = build(clock, driver, live=True)
    with pytest.raises(Exception, match="summary_not_acknowledged"):
        container.portal.service.enable(DEMO_USER, ENABLE.model_copy(update={"acknowledged": False}))
    assert container.portal.service.autopilot(DEMO_USER).settings.enabled is False


def test_a_new_host_waits_for_review_and_nothing_is_opened(clock: FixedClock, driver: FakeDriver) -> None:
    container, _ = build(clock, driver, live=True)
    application_id = prepare(container, allowed=False)
    report = container.portal.runner.run(DEMO_USER, application_id)
    assert report.stop is StopReason.HOST_REVIEW
    assert status_of(container, application_id) is SubmissionStatus.MANUAL_ACTION_REQUIRED
    assert driver.opened == []
    assert any(r.host == HOST and r.policy is HostPolicy.REVIEW for r in container.portal.service.hosts())


def test_a_blocked_host_is_never_opened(clock: FixedClock, driver: FakeDriver) -> None:
    container, _ = build(clock, driver, live=True)
    application_id = prepare(container, allowed=False)
    container.portal.hosts.decide(HOST, HostInput(policy=HostPolicy.BLOCKED))
    assert container.portal.runner.run(DEMO_USER, application_id).stop is StopReason.HOST_BLOCKED
    assert driver.opened == []


def test_with_the_live_switch_off_nothing_is_typed_created_or_sent(clock: FixedClock, driver: FakeDriver) -> None:
    container, sender = build(clock, driver, live=False)
    application_id = prepare(container)
    report = container.portal.runner.run(DEMO_USER, application_id)
    assert report.stop is StopReason.LIVE_SWITCH_OFF
    assert status_of(container, application_id) is SubmissionStatus.MANUAL_ACTION_REQUIRED
    assert driver.filled == {} and driver.uploads == {} and driver.checked == {}
    assert "Create account" not in driver.clicks
    assert container.portal.accounts.views(DEMO_USER) == []
    assert sender.sent == []
    assert container.portal.service.attempt(DEMO_USER, application_id).state is AttemptState.READINESS_ONLY


def test_a_live_run_submits_confirms_and_records_evidence(clock: FixedClock, driver: FakeDriver) -> None:
    container, _ = build(clock, driver, live=True)
    application_id = prepare(container)
    assert (DEMO_USER, application_id) in container.portal.runner.due()
    assert application_id not in [q.application_id for q in container.submissions.due()]
    report = container.portal.runner.run(DEMO_USER, application_id)
    assert report.status is SubmissionStatus.CONFIRMED
    record = container.applications.get(DEMO_USER, application_id)
    assert record.evidence[-1].url == "https://fake.test/done"
    assert record.evidence[-1].screenshot_key is not None
    assert "Thank you for applying" in record.evidence[-1].text
    assert container.files.get(record.evidence[-1].screenshot_key or "") == b"png"
    accounts = container.portal.accounts.views(DEMO_USER)
    assert [a.host for a in accounts] == [HOST]
    again = container.portal.runner.run(DEMO_USER, application_id)
    assert again.status is SubmissionStatus.CONFIRMED
    assert driver.clicks.count("Submit application") == 1


def test_an_error_after_submit_is_outcome_unknown_and_never_retried(clock: FixedClock, driver: FakeDriver) -> None:
    driver.fail_after_click = "Submit application"
    container, _ = build(clock, driver, live=True)
    application_id = prepare(container)
    assert container.portal.runner.run(DEMO_USER, application_id).status is SubmissionStatus.OUTCOME_UNKNOWN
    assert container.portal.service.attempt(DEMO_USER, application_id).submit_clicked
    workspace = container.recommendations._ctx.workspaces.get(DEMO_USER)  # pyright: ignore[reportPrivateUsage]
    next(a for a in workspace.applications if a.id == application_id).submission_status = SubmissionStatus.APPROVED_QUEUED
    container.recommendations._ctx.workspaces.save(DEMO_USER, workspace)  # pyright: ignore[reportPrivateUsage]
    driver.fail_after_click = None
    assert container.portal.runner.run(DEMO_USER, application_id).status is SubmissionStatus.OUTCOME_UNKNOWN
    assert driver.clicks.count("Submit application") == 1


def test_an_unknown_question_stops_then_resumes_without_a_duplicate_account(clock: FixedClock, driver: FakeDriver) -> None:
    driver.pages["step2"].fields.append(field("q", "Preferred programming language"))
    container, _ = build(clock, driver, live=True)
    application_id = prepare(container)
    report = container.portal.runner.run(DEMO_USER, application_id)
    assert report.stop is StopReason.UNKNOWN_QUESTION
    attempt = container.portal.service.attempt(DEMO_USER, application_id)
    assert [q.label for q in attempt.pending] == ["Preferred programming language"]
    assert not attempt.submit_clicked
    container.portal.service.resume(
        DEMO_USER, application_id, ResumeInput(answers=[ResumeAnswer(label="Preferred programming language", answer="Python")])
    )
    assert status_of(container, application_id) is SubmissionStatus.APPROVED_QUEUED
    driver.current = ""
    driver.pages["job"].buttons = {"Apply now": "signin"}
    driver.pages["signin"] = FakePage(
        text="Sign in to apply",
        fields=[field("e", "Email address", FieldKind.EMAIL), field("p", "Password", FieldKind.PASSWORD)],
        buttons={"Sign in": "step1"},
    )
    assert container.portal.runner.run(DEMO_USER, application_id).status is SubmissionStatus.CONFIRMED
    assert driver.filled["q"] == "Python"
    assert len(container.portal.accounts.views(DEMO_USER)) == 1


def test_resume_is_refused_after_submit_was_clicked(clock: FixedClock, driver: FakeDriver) -> None:
    driver.fail_after_click = "Submit application"
    container, _ = build(clock, driver, live=True)
    application_id = prepare(container)
    container.portal.runner.run(DEMO_USER, application_id)
    with pytest.raises(Exception, match="already_submitted"):
        container.portal.service.resume(DEMO_USER, application_id, ResumeInput())


def test_the_user_can_record_completion_and_autopilot_never_repeats_it(clock: FixedClock, driver: FakeDriver) -> None:
    driver.pages["step2"].fields.append(field("q", "Preferred programming language"))
    container, _ = build(clock, driver, live=True)
    application_id = prepare(container)
    container.portal.runner.run(DEMO_USER, application_id)
    container.portal.service.complete(DEMO_USER, application_id)
    assert status_of(container, application_id) is SubmissionStatus.SUBMITTED_AWAITING_CONFIRMATION
    assert container.portal.service.attempt(DEMO_USER, application_id).submit_clicked


def test_account_creation_off_in_autopilot_stops_at_the_wall(clock: FixedClock, driver: FakeDriver) -> None:
    container, _ = build(clock, driver, live=True)
    application_id = prepare(container)
    container.portal.service.enable(DEMO_USER, ENABLE.model_copy(update={"allow_account_creation": False}))
    report = container.portal.runner.run(DEMO_USER, application_id)
    assert report.stop is StopReason.ACCOUNT_CREATION_NOT_ALLOWED
    assert container.portal.accounts.views(DEMO_USER) == []
