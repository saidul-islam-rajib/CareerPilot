import pytest

from careerpilot.administration.context import AdminActor, PageRequest
from careerpilot.administration.permissions import can, permissions_for_role
from careerpilot.bootstrap import Container
from careerpilot.platform.enums import (
    AdminArea,
    AdminRole,
    EmergencyStopScope,
    OpportunityStatus,
    PermissionAction,
    SourceStatus,
    SubmissionStatus,
    ThemeKey,
    UserAccountStatus,
)
from careerpilot.platform.errors import DomainError, ErrorCode
from tests.unit.conftest import CLIENT

PASSWORD = "admin@sober.com"


def actor(container: Container, email: str = "admin@sober.com") -> AdminActor:
    return container.admin_auth.authenticate(container.admin_auth.sign_in(email, PASSWORD, CLIENT.ip).access_token)


def test_role_permissions() -> None:
    assert can(AdminRole.SUPER_ADMIN, AdminArea.ADMINS, PermissionAction.DELETE)
    assert can(AdminRole.READ_ONLY, AdminArea.USERS, PermissionAction.READ)
    assert not can(AdminRole.READ_ONLY, AdminArea.USERS, PermissionAction.UPDATE)
    assert not can(AdminRole.SUPPORT, AdminArea.SETTINGS, PermissionAction.READ)
    assert {p.area for p in permissions_for_role(AdminRole.OPERATIONS)} >= {AdminArea.SOURCES, AdminArea.SETTINGS}


def test_admin_sign_in_rejects_wrong_password_and_admin_tokens_are_not_user_tokens(container: Container) -> None:
    with pytest.raises(DomainError) as error:
        container.admin_auth.sign_in("admin@sober.com", "wrong", CLIENT.ip)
    assert error.value.code is ErrorCode.INVALID_CREDENTIALS
    token = container.admin_auth.sign_in("admin@sober.com", PASSWORD, CLIENT.ip).access_token
    with pytest.raises(DomainError):
        container.auth.authenticate(token)


def test_dashboard_is_computed_from_data(container: Container) -> None:
    dashboard = container.admin_dashboard.get(actor(container))
    assert dashboard.users.total == 14
    assert dashboard.sources.failing == 1
    assert dashboard.opportunities.flagged == 1
    assert len(dashboard.applications.per_day) == container.settings.admin.chart_days
    assert sum(c.count for c in dashboard.applications.by_submission_status) == dashboard.applications.total


def test_user_views_and_changes_are_audited(container: Container) -> None:
    admin = actor(container)
    detail = container.admin_users.get(admin, "usr_demo")
    assert detail.secrets
    assert "value" not in detail.secrets[0].model_dump()
    assert (
        container.admin_users.set_status(admin, "usr_002", UserAccountStatus.SUSPENDED, "user.suspended").status
        is UserAccountStatus.SUSPENDED
    )
    actions = [e.action for e in container.admin_audit.list(admin, PageRequest(page_size=5)).items]
    assert actions[:2] == ["user.suspended", "user.viewed_sensitive"]


def test_paging_search_and_status_filter(container: Container) -> None:
    admin = actor(container)
    page = container.admin_users.list(admin, PageRequest(search="nusrat"))
    assert [u.full_name for u in page.items] == ["Nusrat Akter"]
    suspended = container.admin_users.list(admin, PageRequest(status=UserAccountStatus.SUSPENDED.value))
    assert all(u.status is UserAccountStatus.SUSPENDED for u in suspended.items)
    second = container.admin_users.list(admin, PageRequest(page=2, page_size=10))
    assert second.total == 14
    assert len(second.items) == 4


def test_read_only_admins_cannot_change_anything(container: Container) -> None:
    viewer = actor(container, "viewer@sober.com")
    container.admin_users.list(viewer, PageRequest())
    with pytest.raises(DomainError) as error:
        container.admin_users.set_status(viewer, "usr_002", UserAccountStatus.SUSPENDED, "user.suspended")
    assert error.value.code is ErrorCode.FORBIDDEN


def test_catalog_actions(container: Container) -> None:
    admin = actor(container)
    assert (
        container.admin_catalog.set_opportunity_status(admin, "opp_bd_ctg", OpportunityStatus.FLAGGED, "opportunity.flagged").status
        is OpportunityStatus.FLAGGED
    )
    assert container.admin_catalog.set_source_enabled(admin, "src_university", False).status is SourceStatus.DISABLED
    with pytest.raises(DomainError) as disabled:
        container.admin_catalog.run_source_check(admin, "src_university")
    assert disabled.value.code is ErrorCode.CONFLICT
    assert container.admin_catalog.run_source_check(admin, "src_gov_notices").status is SourceStatus.HEALTHY
    assert container.admin_catalog.cancel_application(admin, "app_admin_1").submission_status is SubmissionStatus.CANCELLED
    with pytest.raises(DomainError):
        container.admin_catalog.cancel_application(admin, "app_bay")


def test_settings_theme_limits_and_emergency_stop(container: Container) -> None:
    admin = actor(container)
    assert (
        container.admin_settings.update(admin, {"active_theme": ThemeKey.HORIZON, "daily_application_cap": 12}).daily_application_cap == 12
    )
    with pytest.raises(DomainError):
        container.admin_settings.update(admin, {"daily_application_cap": 0})
    stopped = container.admin_settings.start_emergency_stop(admin, EmergencyStopScope.ALL_USERS, "Portal incident", None)
    assert stopped.emergency_stop.active
    assert container.admin_dashboard.get(admin).emergency_stop.reason == "Portal incident"
    assert not container.admin_settings.end_emergency_stop(admin).emergency_stop.active


def test_admin_accounts_cannot_change_themselves(container: Container) -> None:
    admin = actor(container)
    assert container.admin_accounts.update(admin, "adm_viewer", AdminRole.SUPPORT, None).role is AdminRole.SUPPORT
    assert container.admin_accounts.update(admin, "adm_ops", None, True).suspended
    with pytest.raises(DomainError) as self_change:
        container.admin_accounts.update(admin, "adm_super", None, True)
    assert self_change.value.code is ErrorCode.CONFLICT
    with pytest.raises(DomainError):
        container.admin_auth.sign_in("operations@sober.com", PASSWORD, CLIENT.ip)
