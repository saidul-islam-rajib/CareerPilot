from datetime import timedelta

import pytest

from careerpilot.automation.enums import DeadlineAction, SkipReason
from careerpilot.automation.models import SettingsInput
from careerpilot.bootstrap import Container
from careerpilot.candidate.models import ApplicationRecord, SubmissionWindow
from careerpilot.platform.clock import FixedClock, iso
from careerpilot.platform.email_delivery import InMemoryEmailSender
from careerpilot.platform.enums import ApplicationMode, PauseDuration, SubmissionHold, SubmissionStatus, SubmissionWindowKind
from tests.unit.automation.conftest import (
    EMAIL_OPPORTUNITY,
    REMOTE_TRACK,
    USER,
    add_candidate,
    rule,
    save,
    workspace_of,
)

CLOSED_WINDOW = SubmissionWindow(kind=SubmissionWindowKind.DAILY_WINDOW, start="02:00", end="03:00")


def queued(container: Container) -> str:
    return next(a.id for a in workspace_of(container).applications if a.opportunity.id == EMAIL_OPPORTUNITY)


def application(container: Container, application_id: str) -> ApplicationRecord:
    return next(a for a in workspace_of(container).applications if a.id == application_id)


def edit(container: Container, application_id: str, **changes: object) -> None:
    workspace = workspace_of(container)
    target = next(a for a in workspace.applications if a.id == application_id)
    for name, value in changes.items():
        setattr(target, name, value)
    save(container, workspace)


def set_deadline(container: Container, hours: float, clock: FixedClock) -> None:
    repository = container.preferences._ctx.opportunities  # pyright: ignore[reportPrivateUsage]
    opportunity = repository.get(EMAIL_OPPORTUNITY)
    assert opportunity is not None
    repository.save(opportunity.model_copy(update={"deadline": iso(clock.now() + timedelta(hours=hours))}))


def test_automatic_application_is_sent_when_nothing_holds(service: Container, sender: InMemoryEmailSender) -> None:
    result = service.submissions.submit(USER, queued(service))
    assert result.hold is None and result.status is SubmissionStatus.SUBMITTED_AWAITING_CONFIRMATION
    assert len(sender.sent) == 1


def test_weekly_cap_holds_only_automatic_applications(service: Container, clock: FixedClock, sender: InMemoryEmailSender) -> None:
    service.automation.update_settings(USER, SettingsInput(weekly_cap=1))
    app_id = queued(service)
    other = next(a.id for a in workspace_of(service).applications if a.id != app_id)
    edit(service, other, applied_at=iso(clock.now()))
    assert service.submissions.submit(USER, app_id).hold is SubmissionHold.WEEKLY_LIMIT
    assert sender.sent == []
    edit(service, app_id, automatic=False)
    assert service.submissions.submit(USER, app_id).hold is None


def test_rule_cap_and_rule_state_hold_its_applications(service: Container, clock: FixedClock) -> None:
    created = service.automation.create_rule(USER, rule(limits={"totalCap": 1}))
    app_id = queued(service)
    other = next(a.id for a in workspace_of(service).applications if a.id != app_id)
    edit(service, app_id, rule_id=created.id)
    edit(service, other, rule_id=created.id, applied_at=iso(clock.now() - timedelta(days=30)))
    assert service.submissions.submit(USER, app_id).hold is SubmissionHold.RULE_LIMIT
    service.automation.update_rule(USER, created.id, rule(enabled=False))
    assert service.submissions.submit(USER, app_id).hold is SubmissionHold.RULE_INACTIVE


def test_inactivity_holds_automatic_applications_until_the_user_returns(
    service: Container, clock: FixedClock, sender: InMemoryEmailSender
) -> None:
    clock.advance(timedelta(days=service.settings.automation.default_inactivity_days + 1))
    assert service.submissions.submit(USER, queued(service)).hold is SubmissionHold.INACTIVE
    assert sender.sent == []


@pytest.mark.parametrize(
    ("action", "hold", "status"),
    [
        (DeadlineAction.NOTIFY_AND_ASK, SubmissionHold.DEADLINE_AT_RISK, SubmissionStatus.APPROVED_QUEUED),
        (DeadlineAction.SKIP, SubmissionHold.DEADLINE_SKIPPED, SubmissionStatus.CANCELLED),
        (DeadlineAction.SUBMIT_EARLIEST, None, SubmissionStatus.SUBMITTED_AWAITING_CONFIRMATION),
    ],
)
def test_window_after_the_deadline_buffer_follows_the_setting(
    service: Container, clock: FixedClock, action: DeadlineAction, hold: SubmissionHold | None, status: SubmissionStatus
) -> None:
    service.preferences.update_submission_window(USER, CLOSED_WINDOW)
    service.automation.update_settings(USER, SettingsInput(deadline_action=action, deadline_buffer_hours=24))
    set_deadline(service, 30, clock)
    result = service.submissions.submit(USER, queued(service))
    assert (result.hold, result.status) == (hold, status)


def test_closed_window_with_a_comfortable_deadline_just_waits(service: Container, clock: FixedClock) -> None:
    service.preferences.update_submission_window(USER, CLOSED_WINDOW)
    set_deadline(service, 24 * 5, clock)
    assert service.submissions.submit(USER, queued(service)).hold is SubmissionHold.OUTSIDE_WINDOW


def test_unknown_outcome_is_never_resubmitted(service: Container, sender: InMemoryEmailSender) -> None:
    unknown = next(a for a in workspace_of(service).applications if a.submission_status is SubmissionStatus.OUTCOME_UNKNOWN)
    assert unknown.id not in [q.application_id for q in service.submissions.due()]
    assert service.submissions.submit(USER, unknown.id).status is SubmissionStatus.OUTCOME_UNKNOWN
    assert sender.sent == []


def test_reconcile_cancels_queued_applications_of_inactive_rules_and_passed_deadlines(service: Container, clock: FixedClock) -> None:
    created = service.automation.create_rule(USER, rule())
    ruled = queued(service)
    late = next(
        a
        for a in workspace_of(service).applications
        if a.automatic and a.id != ruled and a.submission_status is SubmissionStatus.APPROVED_QUEUED
    )
    edit(service, ruled, rule_id=created.id)
    service.automation.update_rule(USER, created.id, rule(enabled=False))
    repository = service.preferences._ctx.opportunities  # pyright: ignore[reportPrivateUsage]
    target = repository.get(late.opportunity.id)
    assert target is not None
    repository.save(target.model_copy(update={"deadline": iso(clock.now() - timedelta(hours=1))}))
    assert service.automation.reconcile() >= 2
    assert application(service, ruled).submission_status is SubmissionStatus.CANCELLED
    assert application(service, late.id).submission_status is SubmissionStatus.CANCELLED


def test_reconcile_notifies_once_about_inactivity_and_deadline_risk(service: Container, clock: FixedClock) -> None:
    service.preferences.update_submission_window(USER, CLOSED_WINDOW)
    set_deadline(service, 30, clock)
    service.automation.reconcile()
    service.automation.reconcile()
    titles = [n.title for n in service.notifications.recent(USER)]
    assert titles.count("A deadline is close and the window is closed") == 1
    clock.advance(timedelta(days=service.settings.automation.default_inactivity_days + 1))
    service.automation.reconcile()
    service.automation.reconcile()
    inactive = [n for n in service.notifications.recent(USER) if n.title == "Automatic applications are paused"]
    assert len(inactive) == 1


def test_pipeline_applies_only_what_an_enabled_rule_accepts(service: Container) -> None:
    created = service.automation.create_rule(USER, rule(track_ids=[REMOTE_TRACK], filters={"minMatchScore": 90}))
    service.preferences.update_track(USER, REMOTE_TRACK, None, ApplicationMode.AUTOMATIC)
    add_candidate(service, "opp_low", score=50)
    add_candidate(service, "opp_high", score=95)
    service.automation.apply(USER, "opp_low")
    service.automation.apply(USER, "opp_high")
    workspace = workspace_of(service)
    ids = {a.opportunity.id: a for a in workspace.applications}
    assert "opp_low" not in ids
    assert ids["opp_high"].rule_id == created.id and ids["opp_high"].automatic
    skipped = workspace.preferences.automation.skipped
    assert [s.opportunity_id for s in skipped if s.opportunity_id == "opp_low"] == ["opp_low"]
    assert skipped[0].reasons == [SkipReason.BELOW_SCORE]


def test_pipeline_asks_the_user_when_the_deadline_buffer_is_at_risk(service: Container, clock: FixedClock) -> None:
    service.preferences.update_track(USER, REMOTE_TRACK, None, ApplicationMode.AUTOMATIC)
    add_candidate(service, "opp_tight", deadline=iso(clock.now() + timedelta(hours=5)))
    service.automation.apply(USER, "opp_tight")
    workspace = workspace_of(service)
    assert all(a.opportunity.id != "opp_tight" for a in workspace.applications)
    assert any(a.opportunity.id == "opp_tight" and a.state.value == "pending" for a in workspace.approvals)


def test_pipeline_does_nothing_while_paused(service: Container) -> None:
    service.preferences.update_track(USER, REMOTE_TRACK, None, ApplicationMode.AUTOMATIC)
    service.preferences.pause(USER, PauseDuration.DAYS, 7)
    add_candidate(service, "opp_paused")
    service.automation.apply(USER, "opp_paused")
    assert all(a.opportunity.id != "opp_paused" for a in workspace_of(service).applications)
