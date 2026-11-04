from pydantic import BaseModel, ConfigDict, Field

from careerpilot.platform.enums import OutcomeStatus, SubmissionStatus
from careerpilot.privacy.enums import (
    ArchiveSection,
    ConsentKind,
    DeletionScope,
    ExportFormat,
    ExportKind,
    ExternalData,
    ReportBucket,
    RetainedRecord,
)


class PrivacyBase(BaseModel):
    model_config = ConfigDict(extra="ignore", frozen=True)


class StatusBucket(PrivacyBase):
    bucket: ReportBucket
    statuses: list[SubmissionStatus]


class ReportsConfig(PrivacyBase):
    week_starts_on: int = Field(ge=1, le=7)
    weekly_digest_weekday: int = Field(ge=1, le=7)
    upcoming_days: int = Field(gt=0)
    max_rows: int = Field(gt=0)
    buckets: list[StatusBucket]
    response_outcomes: list[OutcomeStatus]
    other_track: str


class ExportColumn(PrivacyBase):
    key: str
    label_key: str


class ExportFormatRule(PrivacyBase):
    kind: ExportKind
    formats: list[ExportFormat]


class ExportsConfig(PrivacyBase):
    retention_hours: int = Field(gt=0)
    storage_prefix: str
    max_open_per_user: int = Field(gt=0)
    max_per_day: int = Field(gt=0)
    workers: int = Field(gt=0)
    thread_prefix: str
    rules: list[ExportFormatRule]
    application_columns: list[ExportColumn]
    archive_sections: list[ArchiveSection]
    pdf_line_limit: int = Field(gt=0)
    pdf_lines_per_page: int = Field(gt=0)


class RetentionRule(PrivacyBase):
    record: RetainedRecord
    retention_days: int = Field(gt=0)
    reason_key: str


class DeletionConfig(PrivacyBase):
    anonymized_email_domain: str
    anonymized_id_length: int = Field(gt=0)
    erased: list[DeletionScope]
    retained: list[RetentionRule]
    external: list[ExternalData]
    final_email_enabled: bool


class ConsentRule(PrivacyBase):
    kind: ConsentKind
    required: bool


class ConsentConfig(PrivacyBase):
    kinds: list[ConsentRule]


class PrivacyConfig(PrivacyBase):
    reports: ReportsConfig
    exports: ExportsConfig
    deletion: DeletionConfig
    consent: ConsentConfig
    admin_page_size: int = Field(gt=0)
