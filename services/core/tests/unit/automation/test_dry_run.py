from datetime import timedelta

import pytest

from careerpilot.automation.enums import DeadlineAction, DryRunOutcome, SkipReason
from careerpilot.automation.models import DryRunItem, SettingsInput
from careerpilot.bootstrap import Container
from careerpilot.candidate.models import RequirementItem
from careerpilot.platform.clock import FixedClock, iso
from careerpilot.platform.email_delivery import InMemoryEmailSender
from careerpilot.platform.enums import ApplicationMode, EmergencyStopScope, PauseDuration
from tests.unit.automation.conftest import (
    REMOTE_TRACK,
    SOURCE_OPPORTUNITY,
    USER,
    add_candidate,
    make_remote_automatic,
    rule,
    save,
    workspace_of,
)
from tests.unit.conftest import CLIENT


def item(container: Container, opportunity_id: str, rule_id: str | None = None) -> DryRunItem:
    result = container.automation.dry_run(USER, rule_id)
    return next(i for i in result.items if i.opportunity_id == opportunity_id)


def test_dry_run_shows_what_would_apply_with_materials_and_changes_nothing(service: Container, sender: InMemoryEmailSender) -> None:
    make_remote_automatic(service)
    created = service.automation.create_rule(USER, rule(track_ids=[REMOTE_TRACK], filters={"minMatchScore": 40}))
    applications = len(workspace_of(service).applications)
    approvals = len(workspace_of(service).approvals)
    result = service.automation.dry_run(USER, created.id)
    found = next(i for i in result.items if i.opportunity_id == SOURCE_OPPORTUNITY)
    assert found.outcome is DryRunOutcome.WOULD_APPLY and found.rule_id == created.id
    assert found.materials is not None and found.materials.cv_name and found.materials.cover_letter
    assert SkipReason.USER_ONLY_STEP in found.reasons
    assert result.submitted == 0 and result.would_apply >= 1
    after = workspace_of(service)
    assert (len(after.applications), len(after.approvals)) == (applications, approvals)
    assert after.preferences.automation.skipped == []
    assert sender.sent == []


def test_dry_run_of_a_rule_reports_each_reason(service: Container) -> None:
    make_remote_automatic(service)
    created = service.automation.create_rule(USER, rule(track_ids=[REMOTE_TRACK], filters={"minMatchScore": 95}))
    assert item(service, SOURCE_OPPORTUNITY, created.id).reasons == [SkipReason.BELOW_SCORE]
    service.automation.update_rule(USER, created.id, rule(track_ids=[REMOTE_TRACK], filters={"countries": ["NO"]}))
    assert item(service, SOURCE_OPPORTUNITY, created.id).reasons == [SkipReason.COUNTRY_NOT_ALLOWED]


def test_approve_each_track_is_never_applied_automatically(service: Container) -> None:
    service.preferences.update_track(USER, REMOTE_TRACK, None, ApplicationMode.APPROVE_EACH)
    created = service.automation.create_rule(USER, rule())
    assert item(service, SOURCE_OPPORTUNITY, created.id).reasons == [SkipReason.TRACK_NOT_AUTOMATIC]


def test_blocks_and_global_exclusions_win_over_rules(service: Container) -> None:
    make_remote_automatic(service)
    created = service.automation.create_rule(USER, rule(filters={"excludedKeywords": ["role opp_"]}))
    add_candidate(service, "opp_x1")
    assert item(service, "opp_x1", created.id).reasons == [SkipReason.EXCLUDED_KEYWORD]
    service.automation.update_rule(USER, created.id, rule())
    service.preferences.update_excluded_countries(USER, ["BD"])
    add_candidate(service, "opp_x2", country_code="BD")
    assert item(service, "opp_x2", created.id).reasons == [SkipReason.EXCLUDED_COUNTRY]


def test_unknown_hard_requirement_blocks_unless_the_rule_allows_it(service: Container) -> None:
    make_remote_automatic(service)
    workspace = workspace_of(service)
    workspace.matches[SOURCE_OPPORTUNITY].requirements = [RequirementItem(text="Visa", check="unknown", hard=True)]
    save(service, workspace)
    created = service.automation.create_rule(USER, rule())
    assert item(service, SOURCE_OPPORTUNITY, created.id).reasons == [SkipReason.UNKNOWN_REQUIREMENT]
    service.automation.update_rule(USER, created.id, rule(filters={"allowUnknownRequirements": True}))
    assert item(service, SOURCE_OPPORTUNITY, created.id).outcome is DryRunOutcome.WOULD_APPLY


def test_account_holds_defer_everything(service: Container) -> None:
    make_remote_automatic(service)
    service.preferences.pause(USER, PauseDuration.DAYS, 7)
    result = service.automation.dry_run(USER)
    assert result.holds == [SkipReason.PAUSED]
    assert item(service, SOURCE_OPPORTUNITY).outcome is DryRunOutcome.DEFERRED
    service.preferences.resume(USER)
    admin = service.admin_auth.authenticate(service.admin_auth.sign_in("admin@sober.com", "admin@sober.com", CLIENT.ip).access_token)
    service.admin_settings.start_emergency_stop(admin, EmergencyStopScope.ALL_USERS, "Portal incident", None)
    assert service.automation.dry_run(USER).holds == [SkipReason.EMERGENCY_STOP]


def test_rule_daily_cap_defers_the_rest(service: Container) -> None:
    make_remote_automatic(service)
    service.automation.create_rule(USER, rule(limits={"dailyCap": 1}))
    for number in range(2):
        add_candidate(service, f"opp_c{number}")
    result = service.automation.dry_run(USER)
    assert result.would_apply == 1
    deferred = [i for i in result.items if i.outcome is DryRunOutcome.DEFERRED]
    assert {i.opportunity_id for i in deferred} == {"opp_c0", "opp_c1"}
    assert all(i.reasons == [SkipReason.RULE_CAP] for i in deferred)


def test_inactivity_period_pauses_automation(service: Container, clock: FixedClock) -> None:
    make_remote_automatic(service)
    clock.advance(timedelta(days=service.settings.automation.default_inactivity_days + 1))
    assert service.automation.dry_run(USER).holds == [SkipReason.INACTIVE]


@pytest.mark.parametrize(
    ("action", "outcome", "reasons"),
    [
        (DeadlineAction.NOTIFY_AND_ASK, DryRunOutcome.SKIPPED, [SkipReason.DEADLINE_AT_RISK]),
        (DeadlineAction.SKIP, DryRunOutcome.SKIPPED, [SkipReason.DEADLINE_AT_RISK]),
        (DeadlineAction.SUBMIT_EARLIEST, DryRunOutcome.WOULD_APPLY, [SkipReason.USER_ONLY_STEP]),
    ],
)
def test_deadline_buffer_follows_the_chosen_action(
    service: Container, clock: FixedClock, action: DeadlineAction, outcome: DryRunOutcome, reasons: list[SkipReason]
) -> None:
    make_remote_automatic(service)
    add_candidate(service, "opp_soon", deadline=iso(clock.now() + timedelta(hours=10)))
    service.automation.update_settings(USER, SettingsInput(deadline_action=action, deadline_buffer_hours=24))
    found = item(service, "opp_soon")
    assert (found.outcome, found.reasons) == (outcome, reasons)


def test_passed_deadline_is_a_safeguard(service: Container, clock: FixedClock) -> None:
    make_remote_automatic(service)
    add_candidate(service, "opp_old", deadline=iso(clock.now() - timedelta(hours=1)))
    assert item(service, "opp_old").reasons == [SkipReason.DEADLINE_PASSED]


def test_excluded_organizations_block_every_rule(service: Container) -> None:
    make_remote_automatic(service)
    created = service.automation.create_rule(USER, rule())
    add_candidate(service, "opp_x3", organization="Acme Group Bangladesh")
    assert SkipReason.EXCLUDED_EMPLOYER not in item(service, "opp_x3", created.id).reasons
    service.preferences.update_excluded_organizations(USER, ["Acme Group"])
    assert SkipReason.EXCLUDED_EMPLOYER in item(service, "opp_x3", created.id).reasons
