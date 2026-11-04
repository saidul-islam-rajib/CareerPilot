from enum import StrEnum


class ReportPeriod(StrEnum):
    DAILY = "daily"
    WEEKLY = "weekly"


class ReportBucket(StrEnum):
    SUBMITTED = "submitted"
    CONFIRMED = "confirmed"
    FAILED = "failed"
    WAITING = "waiting"
    OTHER = "other"


class ExportKind(StrEnum):
    APPLICATIONS = "applications"
    REPORT = "report"
    APPLICATION = "application"
    ARCHIVE = "archive"


class ExportFormat(StrEnum):
    CSV = "csv"
    PDF = "pdf"
    ZIP = "zip"


class ExportStatus(StrEnum):
    QUEUED = "queued"
    RUNNING = "running"
    READY = "ready"
    FAILED = "failed"
    EXPIRED = "expired"


class ExportFailure(StrEnum):
    UNEXPECTED = "unexpected"
    APPLICATION_MISSING = "application_missing"


class DeletionStatus(StrEnum):
    REQUESTED = "requested"
    CANCELLED = "cancelled"
    COMPLETED = "completed"


class DeletionScope(StrEnum):
    PROFILE = "profile"
    DOCUMENTS = "documents"
    APPLICATIONS = "applications"
    ANSWERS = "answers"
    PREFERENCES = "preferences"
    SIGN_IN_HISTORY = "sign_in_history"
    CONNECTED_ACCOUNTS = "connected_accounts"
    DEVICES = "devices"
    MESSAGES = "messages"


class RetainedRecord(StrEnum):
    AUDIT_EVENTS = "audit_events"
    CONSENT_RECORDS = "consent_records"
    DELETION_RECORD = "deletion_record"


class ExternalData(StrEnum):
    EMPLOYER_COPIES = "employer_copies"
    PORTAL_ACCOUNTS = "portal_accounts"


class ConsentKind(StrEnum):
    TERMS = "terms"
    PRIVACY = "privacy"
    ANALYTICS = "analytics"
    PRECISE_LOCATION = "precise_location"
    MARKETING = "marketing"
    AI_IMPROVEMENT = "ai_improvement"


class ConsentSource(StrEnum):
    REGISTRATION = "registration"
    SETTINGS = "settings"


class ArchiveSection(StrEnum):
    PROFILE = "profile"
    PREFERENCES = "preferences"
    APPLICATIONS = "applications"
    APPROVALS = "approvals"
    SAVED_ANSWERS = "saved_answers"
    SIGN_IN_ACTIVITY = "sign_in_activity"
    CONSENTS = "consents"
    CONNECTIONS = "connections"
    DELETION_HISTORY = "deletion_history"
    FILES = "files"
