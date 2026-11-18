from dataclasses import dataclass

from careerpilot.administration.context import AdminActor
from careerpilot.administration.models import AuditEntry
from careerpilot.administration.ports import AuditLog
from careerpilot.candidate.ports import OpportunityRepository
from careerpilot.platform.clock import Clock, IdGenerator, iso
from careerpilot.platform.enums import ActorType, AdminArea, PermissionAction
from careerpilot.platform.errors import conflict, not_found, validation_error
from careerpilot.reports.config import ReportsConfig
from careerpilot.reports.enums import ReportAudit, ReportStatus
from careerpilot.reports.models import OpportunityReport, ReportInput
from careerpilot.reports.ports import ReportRepository

REPORT_PREFIX = "rpt"
AUDIT_PREFIX = "aud"


@dataclass(frozen=True)
class ReportsContext:
    config: ReportsConfig
    clock: Clock
    ids: IdGenerator
    reports: ReportRepository
    opportunities: OpportunityRepository
    audit: AuditLog


class OpportunityReportService:
    def __init__(self, context: ReportsContext) -> None:
        self._ctx = context

    def submit(self, user_id: str, opportunity_id: str, data: ReportInput) -> OpportunityReport:
        opportunity = self._ctx.opportunities.get(opportunity_id)
        if opportunity is None:
            raise not_found("opportunity")
        open_reports = [item for item in self._ctx.reports.for_user(user_id) if item.status is ReportStatus.OPEN]
        if len(open_reports) >= self._ctx.config.max_open_per_user:
            raise validation_error("too_many_reports")
        if any(item.opportunity_id == opportunity_id and item.kind is data.kind for item in open_reports):
            raise conflict("already_reported")
        report = OpportunityReport(
            id=self._ctx.ids.next(REPORT_PREFIX),
            user_id=user_id,
            opportunity_id=opportunity_id,
            opportunity_title=opportunity.title,
            kind=data.kind,
            note=data.note.strip()[: self._ctx.config.max_note_length],
            status=ReportStatus.OPEN,
            created_at=iso(self._ctx.clock.now()),
        )
        self._ctx.reports.add(report)
        self._append_audit(user_id, report.id)
        return report

    def mine(self, user_id: str) -> list[OpportunityReport]:
        return sorted(self._ctx.reports.for_user(user_id), key=lambda item: item.created_at, reverse=True)

    def admin_list(self, admin: AdminActor, status: ReportStatus | None) -> list[OpportunityReport]:
        admin.require(AdminArea.OPPORTUNITIES, PermissionAction.READ)
        return self._ctx.reports.with_status(status)

    def set_status(self, admin: AdminActor, report_id: str, status: ReportStatus) -> OpportunityReport:
        admin.require(AdminArea.OPPORTUNITIES, PermissionAction.UPDATE)
        report = self._ctx.reports.get(report_id)
        if report is None:
            raise not_found("report")
        updated = report.model_copy(update={"status": status, "reviewed_by": admin.summary.id, "reviewed_at": iso(self._ctx.clock.now())})
        self._ctx.reports.save(updated)
        admin.record(f"{ReportAudit.STATUS_CHANGED.value}.{status.value}", report_id)
        return updated

    def _append_audit(self, user_id: str, report_id: str) -> None:
        self._ctx.audit.append(
            AuditEntry(
                id=self._ctx.ids.next(AUDIT_PREFIX),
                at=iso(self._ctx.clock.now()),
                actor_name=user_id,
                actor_type=ActorType.USER,
                action=ReportAudit.SUBMITTED.value,
                target=report_id,
            )
        )
