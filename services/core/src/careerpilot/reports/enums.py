from enum import StrEnum


class ReportKind(StrEnum):
    DEAD_LINK = "dead_link"
    INACCURATE_DETAIL = "inaccurate_detail"
    FALSE_MERGE = "false_merge"
    FRAUD = "fraud"


class ReportStatus(StrEnum):
    OPEN = "open"
    REVIEWED = "reviewed"
    ACTIONED = "actioned"
    DISMISSED = "dismissed"


class ReportAudit(StrEnum):
    SUBMITTED = "opportunity_report.submitted"
    STATUS_CHANGED = "opportunity_report.status_changed"
