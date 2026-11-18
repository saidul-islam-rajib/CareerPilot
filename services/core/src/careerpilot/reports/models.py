from pydantic import Field

from careerpilot.platform.model import CamelModel
from careerpilot.reports.enums import ReportKind, ReportStatus


class ReportInput(CamelModel):
    kind: ReportKind
    note: str = Field(default="", max_length=2000)


class StatusInput(CamelModel):
    status: ReportStatus


class OpportunityReport(CamelModel):
    id: str
    user_id: str
    opportunity_id: str
    opportunity_title: str
    kind: ReportKind
    note: str
    status: ReportStatus
    created_at: str
    reviewed_by: str | None = None
    reviewed_at: str | None = None
