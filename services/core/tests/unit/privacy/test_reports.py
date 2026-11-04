import pytest

from careerpilot.bootstrap import Container
from careerpilot.platform.errors import DomainError
from careerpilot.privacy.enums import ReportBucket, ReportPeriod
from tests.unit.conftest import DEMO_USER


def counts(container: Container, period: ReportPeriod, on: str) -> dict[ReportBucket, int]:
    report = container.privacy.reports.build(DEMO_USER, period, on)
    return {b.bucket: b.count for b in report.buckets}


def test_daily_report_uses_the_users_time_zone_and_buckets(container: Container) -> None:
    report = container.privacy.reports.build(DEMO_USER, ReportPeriod.DAILY, "2026-10-17")
    assert [r.application_id for r in report.rows] == ["app_kite"]
    assert report.rows[0].bucket is ReportBucket.CONFIRMED
    assert report.time_zone == "Asia/Dhaka"
    assert counts(container, ReportPeriod.DAILY, "2026-10-18")[ReportBucket.FAILED] == 1


def test_daily_report_without_activity_is_empty(container: Container) -> None:
    report = container.privacy.reports.build(DEMO_USER, ReportPeriod.DAILY, "2026-01-01")
    assert report.rows == []
    assert report.total == 0
    assert all(b.count == 0 for b in report.buckets)


def test_weekly_report_totals_by_track_route_and_status(container: Container) -> None:
    report = container.privacy.reports.build(DEMO_USER, ReportPeriod.WEEKLY, "2026-10-14")
    assert report.start_date == "2026-10-12"
    assert report.end_date == "2026-10-18"
    assert {r.application_id for r in report.rows} == {"app_bay", "app_kite", "app_meghna"}
    assert report.responses == 2
    assert sum(item.count for item in report.by_route) == 3
    assert sum(item.count for item in report.by_track) == 3
    assert {item.label for item in report.by_route} == {"email", "ats_portal", "employer_portal"}


def test_weekly_report_lists_open_tasks_due_within_the_horizon(container: Container) -> None:
    report = container.privacy.reports.build(DEMO_USER, ReportPeriod.WEEKLY, "2026-10-20")
    assert [item.due_at for item in report.upcoming] == sorted(item.due_at for item in report.upcoming)
    assert all(item.due_at >= "2026-10-20" for item in report.upcoming)


def test_report_for_a_user_without_applications_is_empty(container: Container) -> None:
    report = container.privacy.reports.build("usr_nobody", ReportPeriod.WEEKLY, "2026-10-20")
    assert report.rows == []


def test_invalid_report_date_is_rejected(container: Container) -> None:
    with pytest.raises(DomainError):
        container.privacy.reports.build(DEMO_USER, ReportPeriod.DAILY, "not-a-date")
