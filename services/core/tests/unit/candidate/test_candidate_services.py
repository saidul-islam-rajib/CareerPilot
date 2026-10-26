import dataclasses

import pytest

from careerpilot.bootstrap import Container
from careerpilot.candidate.models import SubmissionWindow
from careerpilot.candidate.services.auth import Registration
from careerpilot.platform.email_delivery import InMemoryEmailSender
from careerpilot.platform.enums import (
    ApplicationFilter,
    ApplicationMode,
    ApprovalState,
    ContactKind,
    OpportunityDecision,
    PauseDuration,
    SubmissionStatus,
    SubmissionWindowKind,
    UserAccountStatus,
)
from careerpilot.platform.errors import DomainError, ErrorCode
from tests.unit.conftest import CLIENT, DEMO_USER, register_and_activate

REGISTRATION = Registration(full_name="New Person", email="new@example.com", consent=True, terms_version="1.0", privacy_version="1.0")


def admin_actor(container: Container):  # type: ignore[no-untyped-def]
    return container.admin_auth.authenticate(container.admin_auth.sign_in("admin@sober.com", "admin@sober.com", CLIENT.ip).access_token)


def test_sign_in_records_activity_and_issues_a_verifiable_token(container: Container) -> None:
    session = container.auth.sign_in("ADMIN@sober.com ", "admin@sober.com", CLIENT)
    assert container.auth.authenticate(session.access_token).id == DEMO_USER
    activity = container.preferences.sign_in_activity(DEMO_USER)
    assert activity[0].success
    assert activity[0].current


def test_wrong_password_is_rejected_and_recorded(container: Container) -> None:
    with pytest.raises(DomainError) as error:
        container.auth.sign_in("admin@sober.com", "wrong", CLIENT)
    assert error.value.code is ErrorCode.INVALID_CREDENTIALS
    assert container.preferences.sign_in_activity(DEMO_USER)[0].success is False


def test_registration_requires_consent_and_activates_through_the_emailed_link(container: Container, outbox: InMemoryEmailSender) -> None:
    session = register_and_activate(container, outbox, REGISTRATION)
    assert session.user.email == "new@example.com"
    assert container.dashboard.get(session.user.id).counts.new_matches == 0
    with pytest.raises(DomainError) as no_consent:
        container.auth.register(dataclasses.replace(REGISTRATION, email="x@example.com", consent=False), CLIENT)
    assert no_consent.value.code is ErrorCode.VALIDATION


def test_suspended_accounts_cannot_sign_in(container: Container) -> None:
    container.admin_users.set_status(admin_actor(container), DEMO_USER, UserAccountStatus.SUSPENDED, "user.suspended")
    with pytest.raises(DomainError):
        container.auth.sign_in("admin@sober.com", "admin@sober.com", CLIENT)


def test_dashboard_limits_tracks_and_hides_dismissed(container: Container) -> None:
    container.preferences.update_track(DEMO_USER, "trk_remote", 1, None)
    container.opportunities.decide(DEMO_USER, "opp_bd_dhaka", OpportunityDecision.DISMISSED)
    dashboard = container.dashboard.get(DEMO_USER)
    remote = next(d for d in dashboard.tracks if d.track.id == "trk_remote")
    assert [o.id for o in remote.opportunities] == ["opp_remote_frontend"]
    assert all(o.id != "opp_bd_dhaka" for d in dashboard.tracks for o in d.opportunities)
    assert dashboard.counts.awaiting_approval == 2


def test_approval_flow_queues_application_automatically(container: Container) -> None:
    detail = container.approvals.update_answer(DEMO_USER, "apr_frontend", "q_notice", "15 days")
    assert next(a for a in detail.materials.answers if a.id == "q_notice").answer == "15 days"
    approved = container.approvals.approve(DEMO_USER, "apr_frontend")
    assert approved.state is ApprovalState.APPROVED
    assert approved.submission_window_label == "00:00–01:00"
    active = container.applications.list(DEMO_USER, ApplicationFilter.ACTIVE)
    queued = next(a for a in active if a.opportunity.id == "opp_remote_frontend")
    assert queued.submission_status is SubmissionStatus.APPROVED_QUEUED
    assert container.applications.get(DEMO_USER, queued.id).timeline[-1].text == "You approved the application"
    with pytest.raises(DomainError) as again:
        container.approvals.approve(DEMO_USER, "apr_frontend")
    assert again.value.code is ErrorCode.CONFLICT


def test_prepare_is_idempotent_per_opportunity(container: Container) -> None:
    first = container.approvals.prepare(DEMO_USER, "opp_bd_ctg")
    second = container.approvals.prepare(DEMO_USER, "opp_bd_ctg")
    assert first.id == second.id
    assert container.opportunities.detail(DEMO_USER, "opp_bd_ctg").decision is OpportunityDecision.INTERESTED


def test_application_filters(container: Container) -> None:
    attention = {a.submission_status for a in container.applications.list(DEMO_USER, ApplicationFilter.ATTENTION)}
    assert attention == {SubmissionStatus.MANUAL_ACTION_REQUIRED, SubmissionStatus.OUTCOME_UNKNOWN}
    everything = container.applications.list(DEMO_USER, ApplicationFilter.ALL)
    queued_by_rule = [a for a in everything if a.submission_status is SubmissionStatus.APPROVED_QUEUED]
    assert len(everything) == 4 + len(queued_by_rule)


def test_automatic_tracks_approve_new_matches_by_rule(container: Container) -> None:
    queued = [
        a for a in container.applications.list(DEMO_USER, ApplicationFilter.ALL) if a.submission_status is SubmissionStatus.APPROVED_QUEUED
    ]
    assert {a.opportunity.organization for a in queued} == {"Northwind Labs"}
    record = container.applications.get(DEMO_USER, queued[0].id)
    assert record.timeline[-1].text == "Approved by your automatic rule"
    assert record.materials is not None and "Northwind Labs" in record.materials.cover_letter


def test_profile_reorder_and_primary(container: Container) -> None:
    ids = [c.id for c in container.profile.get(DEMO_USER).active_contacts()][::-1]
    reordered = container.profile.reorder_contacts(DEMO_USER, ids).active_contacts()
    assert [c.id for c in reordered] == ids
    assert [c.position for c in reordered] == [1, 2, 3, 4]
    with pytest.raises(DomainError):
        container.profile.reorder_contacts(DEMO_USER, ids[:1])
    contacts = container.profile.set_primary_contact(DEMO_USER, "c_email_personal").contacts
    assert [c.id for c in contacts if c.is_primary and c.kind is ContactKind.EMAIL] == ["c_email_personal"]


def test_pause_durations_and_resume(container: Container) -> None:
    week = container.preferences.pause(DEMO_USER, PauseDuration.DAYS, 7).pause
    assert week is not None
    assert week.until == "2026-10-27T06:00:00.000Z"
    quarter = container.preferences.pause(DEMO_USER, PauseDuration.MONTHS, 3).pause
    assert quarter is not None
    assert quarter.until == "2027-01-20T06:00:00.000Z"
    forever = container.preferences.pause(DEMO_USER, PauseDuration.INDEFINITE, None).pause
    assert forever is not None
    assert forever.until is None
    with pytest.raises(DomainError):
        container.preferences.pause(DEMO_USER, PauseDuration.DAYS, 999)
    assert container.preferences.resume(DEMO_USER).pause is None


def test_window_track_and_deletion(container: Container) -> None:
    window = SubmissionWindow(kind=SubmissionWindowKind.DAILY_WINDOW, start="23:30", end="01:00")
    assert container.preferences.update_submission_window(DEMO_USER, window).submission_window.start == "23:30"
    with pytest.raises(DomainError):
        container.preferences.update_submission_window(DEMO_USER, window.model_copy(update={"start": "25:00"}))
    with pytest.raises(DomainError):
        container.preferences.update_track(DEMO_USER, "trk_remote", 0, None)
    assert container.preferences.update_track(DEMO_USER, "trk_remote", None, ApplicationMode.AUTOMATIC).mode is ApplicationMode.AUTOMATIC
    assert container.preferences.request_account_deletion(DEMO_USER).scheduled_for == "2026-11-03T06:00:00.000Z"


def test_public_config_reflects_admin_theme(container: Container) -> None:
    assert container.public_config.get()["theme"] == "sober"
    container.admin_settings.update(admin_actor(container), {"active_theme": "orchid"})
    config = container.public_config.get()
    assert config["theme"] == "orchid"
    assert config["branding"]["developerUrl"] == "https://team-sober.com/"
