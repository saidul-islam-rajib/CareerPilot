import pytest

from careerpilot.automation.enums import DeadlineAction
from careerpilot.automation.models import RuleInput, SettingsInput
from careerpilot.bootstrap import Container
from careerpilot.platform.errors import DomainError, ErrorCode
from tests.unit.automation.conftest import REMOTE_TRACK, USER, rule, workspace_of


def test_rule_is_created_listed_updated_and_soft_deleted(service: Container) -> None:
    created = service.automation.create_rule(
        USER,
        rule(track_ids=[REMOTE_TRACK], filters={"minMatchScore": 70, "countries": ["bd", "BD"], "excludedEmployers": ["Acme", "acme "]}),
    )
    assert created.id and created.position == 0 and created.deleted_at is None
    assert created.filters.countries == ["BD"]
    assert created.filters.excluded_employers == ["Acme"]
    assert [r.id for r in service.automation.overview(USER).rules] == [created.id]
    updated = service.automation.update_rule(USER, created.id, rule("Renamed", enabled=False))
    assert (updated.name, updated.enabled, updated.id, updated.created_at) == ("Renamed", False, created.id, created.created_at)
    service.automation.delete_rule(USER, created.id)
    assert service.automation.overview(USER).rules == []
    kept = workspace_of(service).preferences.automation.rules
    assert len(kept) == 1 and kept[0].deleted_at is not None


@pytest.mark.parametrize(
    "fields",
    [
        {"filters": {"minMatchScore": 101}},
        {"filters": {"countries": ["Bangladesh"]}},
        {"filters": {"allowedRoutes": ["fax"]}},
        {"filters": {"excludedKeywords": [" "]}},
        {"track_ids": ["trk_missing"]},
        {"materials": {"cvDocumentId": "doc_missing"}},
        {"limits": {"dailyCap": 0}},
        {"limits": {"weeklyCap": 100000}},
        {"limits": {"expiresOn": "tomorrow"}},
        {"schedule": {"kind": "daily_window", "start": "25:00", "end": "02:00"}},
    ],
)
def test_invalid_rules_are_refused(service: Container, fields: dict[str, object]) -> None:
    with pytest.raises(DomainError) as error:
        service.automation.create_rule(USER, RuleInput.model_validate({"name": "Invalid", **fields}))
    assert error.value.code is ErrorCode.VALIDATION


def test_rule_count_is_limited_by_config(service: Container) -> None:
    for number in range(service.settings.automation.max_rules):
        service.automation.create_rule(USER, rule(f"Rule {number}"))
    with pytest.raises(DomainError):
        service.automation.create_rule(USER, rule("One too many"))


def test_rules_are_reordered_and_the_order_must_be_complete(service: Container) -> None:
    first = service.automation.create_rule(USER, rule("First"))
    second = service.automation.create_rule(USER, rule("Second"))
    ordered = service.automation.reorder(USER, [second.id, first.id])
    assert [r.name for r in ordered] == ["Second", "First"]
    with pytest.raises(DomainError):
        service.automation.reorder(USER, [first.id])


def test_unknown_rule_is_not_found(service: Container) -> None:
    with pytest.raises(DomainError) as error:
        service.automation.update_rule(USER, "rul_missing", rule())
    assert error.value.code is ErrorCode.NOT_FOUND


def test_settings_default_from_config_and_are_bounded(service: Container) -> None:
    config = service.settings.automation
    effective = service.automation.overview(USER).settings
    assert effective.deadline_buffer_hours == config.default_deadline_buffer_hours
    assert effective.deadline_action is DeadlineAction.NOTIFY_AND_ASK
    updated = service.automation.update_settings(
        USER, SettingsInput(deadline_buffer_hours=48, deadline_action=DeadlineAction.SKIP, weekly_cap=5, inactivity_days=14)
    )
    assert (updated.deadline_buffer_hours, updated.deadline_action, updated.weekly_cap, updated.inactivity_days) == (
        48,
        DeadlineAction.SKIP,
        5,
        14,
    )
    for bad in (
        SettingsInput(inactivity_days=config.min_inactivity_days - 1),
        SettingsInput(weekly_cap=config.max_weekly_cap + 1),
        SettingsInput(deadline_buffer_hours=-1),
    ):
        with pytest.raises(DomainError):
            service.automation.update_settings(USER, bad)
