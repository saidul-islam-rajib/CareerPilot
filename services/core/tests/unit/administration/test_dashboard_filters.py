from careerpilot.administration.live_figures import DashboardFilter
from careerpilot.bootstrap import Container
from careerpilot.platform.enums import HealthTarget
from tests.unit.administration.test_admin_visibility import admin

NOBODY = "usr_does_not_exist"
FAR_FUTURE = "2999-01-01"


def test_user_filter_narrows_users_and_applications(container: Container) -> None:
    everyone = container.admin_dashboard.get(admin(container))
    only = container.user_records.rows()[0]
    narrowed = container.admin_dashboard.get(admin(container), DashboardFilter(user_id=only.id))
    assert narrowed.users.total == 1
    assert narrowed.applications.total <= everyone.applications.total
    assert container.admin_dashboard.get(admin(container), DashboardFilter(user_id=NOBODY)).users.total == 0


def test_date_country_and_track_filters_exclude_non_matching_rows(container: Container) -> None:
    row = container.user_records.rows()[0]
    assert container.admin_dashboard.get(admin(container), DashboardFilter(date_from=FAR_FUTURE)).users.total == 0
    assert container.admin_dashboard.get(admin(container), DashboardFilter(country=row.country)).users.total >= 1
    assert container.admin_dashboard.get(admin(container), DashboardFilter(track=NOBODY)).users.total == 0


def test_notifications_and_health_are_live(container: Container) -> None:
    dashboard = container.admin_dashboard.get(admin(container))
    assert dashboard.notifications.sent >= dashboard.notifications.delivered
    assert {HealthTarget.CACHE.value, HealthTarget.COORDINATION.value} <= {item.service for item in dashboard.health}
