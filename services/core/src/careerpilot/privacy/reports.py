from collections import Counter
from collections.abc import Iterable
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from careerpilot.candidate.context import CandidateContext
from careerpilot.candidate.models import ApplicationRecord, FollowUpTask
from careerpilot.candidate.ports import CandidateWorkspace
from careerpilot.platform.clock import parse_iso
from careerpilot.platform.enums import SubmissionStatus, TaskStatus
from careerpilot.platform.errors import validation_error
from careerpilot.privacy.config import ReportsConfig
from careerpilot.privacy.enums import ReportBucket, ReportPeriod
from careerpilot.privacy.models import ActivityReport, BucketCount, LabelCount, ReportRow, StatusCount, UpcomingItem

WEEK_DAYS = 7


@dataclass(frozen=True)
class Window:
    start: date
    end: date
    zone: ZoneInfo

    @property
    def starts_at(self) -> datetime:
        return datetime.combine(self.start, time.min, self.zone)

    @property
    def ends_at(self) -> datetime:
        return datetime.combine(self.end + timedelta(days=1), time.min, self.zone)

    def contains(self, value: str | None) -> bool:
        if not value:
            return False
        return self.starts_at <= parse_iso(value) < self.ends_at


def window_for(period: ReportPeriod, anchor: date, week_starts_on: int) -> tuple[date, date]:
    if period is ReportPeriod.DAILY:
        return anchor, anchor
    start = anchor - timedelta(days=(anchor.isoweekday() - week_starts_on) % WEEK_DAYS)
    return start, start + timedelta(days=WEEK_DAYS - 1)


def parse_date(value: str | None, fallback: date) -> date:
    if value is None:
        return fallback
    try:
        return date.fromisoformat(value)
    except ValueError as error:
        raise validation_error("date") from error


def bucket_lookup(config: ReportsConfig) -> dict[SubmissionStatus, ReportBucket]:
    return {status: rule.bucket for rule in config.buckets for status in rule.statuses}


def track_label(workspace: CandidateWorkspace, opportunity_id: str, fallback: str) -> str:
    for track in workspace.preferences.tracks:
        if opportunity_id in workspace.track_opportunities.get(track.id, []):
            return track.name or track.kind
    return fallback


def open_tasks(application: ApplicationRecord) -> Iterable[FollowUpTask]:
    return (task for task in application.tasks if task.status is TaskStatus.OPEN and task.due_at)


class ReportService:
    def __init__(self, context: CandidateContext) -> None:
        self._ctx = context
        self._config = context.settings.privacy.reports
        self._buckets = bucket_lookup(self._config)

    def build(self, user_id: str, period: ReportPeriod, on: str | None = None) -> ActivityReport:
        workspace = self._ctx.workspaces.get(user_id)
        zone = ZoneInfo(workspace.preferences.time_zone)
        now = self._ctx.clock.now()
        start, end = window_for(period, parse_date(on, now.astimezone(zone).date()), self._config.week_starts_on)
        window = Window(start, end, zone)
        applications = [a for a in workspace.applications if window.contains(a.applied_at) or window.contains(a.updated_at)]
        rows = [self._row(workspace, a) for a in applications][: self._config.max_rows]
        report = ActivityReport(
            period=period,
            start_date=start.isoformat(),
            end_date=end.isoformat(),
            time_zone=workspace.preferences.time_zone,
            buckets=self._counts(rows),
            total=len(rows),
            responses=sum(1 for a in applications if a.outcome_status in self._config.response_outcomes),
            rows=rows,
        )
        if period is ReportPeriod.WEEKLY:
            report.by_status = [StatusCount(status=s, count=n) for s, n in Counter(r.submission_status for r in rows).items()]
            report.by_track = self._labels(r.track for r in rows)
            report.by_route = self._labels(r.route for r in rows)
            report.upcoming = self._upcoming(workspace, now)
        return report

    def _row(self, workspace: CandidateWorkspace, application: ApplicationRecord) -> ReportRow:
        opportunity = application.opportunity
        return ReportRow(
            application_id=application.id,
            title=opportunity.title,
            organization=opportunity.organization,
            track=track_label(workspace, opportunity.id, self._config.other_track),
            route=application.route,
            submission_status=application.submission_status,
            outcome_status=application.outcome_status,
            bucket=self._buckets.get(application.submission_status, ReportBucket.OTHER),
            applied_at=application.applied_at,
            updated_at=application.updated_at,
        )

    def _counts(self, rows: list[ReportRow]) -> list[BucketCount]:
        found = Counter(row.bucket for row in rows)
        return [BucketCount(bucket=rule.bucket, count=found.get(rule.bucket, 0)) for rule in self._config.buckets]

    @staticmethod
    def _labels(values: Iterable[str]) -> list[LabelCount]:
        return [LabelCount(label=label, count=count) for label, count in Counter(values).most_common()]

    def _upcoming(self, workspace: CandidateWorkspace, now: datetime) -> list[UpcomingItem]:
        horizon = now + timedelta(days=self._config.upcoming_days)
        items = [
            UpcomingItem(
                application_id=a.id,
                organization=a.opportunity.organization,
                title=a.opportunity.title,
                kind=task.kind,
                task_title=task.title,
                due_at=task.due_at or "",
            )
            for a in workspace.applications
            for task in open_tasks(a)
            if now <= parse_iso(task.due_at or "") <= horizon
        ]
        return sorted(items, key=lambda item: item.due_at)
