from pydantic import Field

from careerpilot.platform.enums import OutcomeStatus, SubmissionStatus, TaskKind
from careerpilot.platform.model import CamelModel
from careerpilot.privacy.enums import (
    ConsentKind,
    ConsentSource,
    DeletionScope,
    DeletionStatus,
    ExportFailure,
    ExportFormat,
    ExportKind,
    ExportStatus,
    ExternalData,
    ReportBucket,
    ReportPeriod,
    RetainedRecord,
)


class BucketCount(CamelModel):
    bucket: ReportBucket
    count: int


class LabelCount(CamelModel):
    label: str
    count: int


class StatusCount(CamelModel):
    status: SubmissionStatus
    count: int


class ReportRow(CamelModel):
    application_id: str
    title: str
    organization: str
    track: str
    route: str
    submission_status: SubmissionStatus
    outcome_status: OutcomeStatus
    bucket: ReportBucket
    applied_at: str | None = None
    updated_at: str


class UpcomingItem(CamelModel):
    application_id: str
    organization: str
    title: str
    kind: TaskKind
    task_title: str
    due_at: str


class ActivityReport(CamelModel):
    period: ReportPeriod
    start_date: str
    end_date: str
    time_zone: str
    buckets: list[BucketCount]
    total: int
    responses: int
    by_status: list[StatusCount] = Field(default_factory=list[StatusCount])
    by_track: list[LabelCount] = Field(default_factory=list[LabelCount])
    by_route: list[LabelCount] = Field(default_factory=list[LabelCount])
    rows: list[ReportRow]
    upcoming: list[UpcomingItem] = Field(default_factory=list[UpcomingItem])


class ExportRequest(CamelModel):
    id: str
    user_id: str
    kind: ExportKind
    format: ExportFormat
    status: ExportStatus
    requested_at: str
    period: ReportPeriod | None = None
    date: str | None = None
    application_id: str | None = None
    completed_at: str | None = None
    expires_at: str | None = None
    file_key: str | None = None
    file_name: str | None = None
    size_bytes: int | None = None
    failure: ExportFailure | None = None


class ExportView(CamelModel):
    id: str
    kind: ExportKind
    format: ExportFormat
    status: ExportStatus
    requested_at: str
    period: ReportPeriod | None = None
    date: str | None = None
    application_id: str | None = None
    completed_at: str | None = None
    expires_at: str | None = None
    file_name: str | None = None
    size_bytes: int | None = None
    download_url: str | None = None
    failure: ExportFailure | None = None


class AdminExportView(CamelModel):
    id: str
    user_id: str
    kind: ExportKind
    format: ExportFormat
    status: ExportStatus
    requested_at: str
    completed_at: str | None = None
    expires_at: str | None = None
    size_bytes: int | None = None
    failure: ExportFailure | None = None


class DeletionRecord(CamelModel):
    id: str
    user_id: str
    status: DeletionStatus
    requested_at: str
    scheduled_for: str
    cancelled_at: str | None = None
    completed_at: str | None = None


class RetainedItem(CamelModel):
    record: RetainedRecord
    retention_days: int
    reason: str


class DeletionPlan(CamelModel):
    grace_days: int
    erased: list[DeletionScope]
    retained: list[RetainedItem]
    external: list[ExternalData]


class DeletionView(CamelModel):
    status: DeletionStatus | None = None
    requested_at: str | None = None
    scheduled_for: str | None = None
    plan: DeletionPlan


class AdminDeletionView(CamelModel):
    id: str
    user_id: str
    status: DeletionStatus
    requested_at: str
    scheduled_for: str
    cancelled_at: str | None = None
    completed_at: str | None = None


class ConsentRecord(CamelModel):
    id: str
    user_id: str
    kind: ConsentKind
    granted: bool
    version: str
    at: str
    ip: str
    device: str
    source: ConsentSource


class ConsentEntry(CamelModel):
    kind: ConsentKind
    required: bool
    granted: bool
    version: str | None = None
    at: str | None = None


class ConsentOverview(CamelModel):
    current: list[ConsentEntry]
    history: list[ConsentRecord]
