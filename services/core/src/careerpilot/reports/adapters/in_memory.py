from careerpilot.reports.enums import ReportStatus
from careerpilot.reports.models import OpportunityReport


class InMemoryReports:
    def __init__(self) -> None:
        self._items: dict[str, OpportunityReport] = {}

    def add(self, report: OpportunityReport) -> None:
        self._items[report.id] = report

    def get(self, report_id: str) -> OpportunityReport | None:
        return self._items.get(report_id)

    def save(self, report: OpportunityReport) -> None:
        self._items[report.id] = report

    def for_user(self, user_id: str) -> list[OpportunityReport]:
        return [item for item in self._items.values() if item.user_id == user_id]

    def with_status(self, status: ReportStatus | None) -> list[OpportunityReport]:
        matching = (item for item in self._items.values() if status is None or item.status is status)
        return sorted(matching, key=lambda item: item.created_at, reverse=True)
