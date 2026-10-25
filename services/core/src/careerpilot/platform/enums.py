from enum import StrEnum


class SubmissionStatus(StrEnum):
    NOT_STARTED = "not_started"
    PREPARING = "preparing"
    AWAITING_USER_INFORMATION = "awaiting_user_information"
    AWAITING_APPROVAL = "awaiting_approval"
    APPROVED_QUEUED = "approved_queued"
    SUBMITTING = "submitting"
    SUBMITTED_AWAITING_CONFIRMATION = "submitted_awaiting_confirmation"
    CONFIRMED = "confirmed"
    FAILED = "failed"
    MANUAL_ACTION_REQUIRED = "manual_action_required"
    OUTCOME_UNKNOWN = "outcome_unknown"
    CANCELLED = "cancelled"


class OutcomeStatus(StrEnum):
    NO_RESPONSE_YET = "no_response_yet"
    UNDER_REVIEW = "under_review"
    ASSESSMENT = "assessment"
    INTERVIEW = "interview"
    OFFER_RECEIVED = "offer_received"
    ADMITTED = "admitted"
    CONDITIONALLY_ADMITTED = "conditionally_admitted"
    WAITLISTED = "waitlisted"
    DEFERRED = "deferred"
    REJECTED = "rejected"
    OFFER_ACCEPTED = "offer_accepted"
    OFFER_DECLINED = "offer_declined"
    WITHDRAWN = "withdrawn"
    CLOSED = "closed"


class OpportunityDecision(StrEnum):
    INTERESTED = "interested"
    SAVED = "saved"
    DISMISSED = "dismissed"
    NOT_ELIGIBLE = "not_eligible"
    IRRELEVANT = "irrelevant"


class ApplicationMode(StrEnum):
    OFF = "off"
    APPROVE_EACH = "approve_each"
    AUTOMATIC = "automatic"


class ApprovalState(StrEnum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    EXPIRED = "expired"


class PauseDuration(StrEnum):
    DAYS = "days"
    MONTHS = "months"
    YEARS = "years"
    INDEFINITE = "indefinite"
    UNTIL = "until"


class PauseScope(StrEnum):
    ALL = "all"
    TRACK = "track"


class SubmissionWindowKind(StrEnum):
    AS_SOON_AS_READY = "as_soon_as_ready"
    DAILY_WINDOW = "daily_window"


class TimelineActor(StrEnum):
    SYSTEM = "system"
    USER = "user"
    EMPLOYER = "employer"
    ADMIN = "admin"


class AnswerSource(StrEnum):
    PROFILE = "profile"
    AI = "ai"
    USER = "user"


class ApplicationFilter(StrEnum):
    ALL = "all"
    ACTIVE = "active"
    SUBMITTED = "submitted"
    ATTENTION = "attention"


class ContactKind(StrEnum):
    EMAIL = "email"
    PHONE = "phone"


class UserAccountStatus(StrEnum):
    ACTIVE = "active"
    PAUSED = "paused"
    SUSPENDED = "suspended"
    PENDING_DELETION = "pending_deletion"
    DELETED = "deleted"


class SourceStatus(StrEnum):
    HEALTHY = "healthy"
    DEGRADED = "degraded"
    FAILING = "failing"
    DISABLED = "disabled"


class OpportunityStatus(StrEnum):
    ACTIVE = "active"
    EXPIRED = "expired"
    FLAGGED = "flagged"
    DUPLICATE = "duplicate"


class AdminRole(StrEnum):
    SUPER_ADMIN = "super_admin"
    SUPPORT = "support"
    OPERATIONS = "operations"
    READ_ONLY = "read_only"


class AdminArea(StrEnum):
    DASHBOARD = "dashboard"
    USERS = "users"
    OPPORTUNITIES = "opportunities"
    SOURCES = "sources"
    APPLICATIONS = "applications"
    SETTINGS = "settings"
    AUDIT = "audit"
    ADMINS = "admins"


class PermissionAction(StrEnum):
    READ = "read"
    CREATE = "create"
    UPDATE = "update"
    DELETE = "delete"


class EmergencyStopScope(StrEnum):
    ALL_USERS = "all_users"
    SOURCE = "source"
    ROUTE = "route"


class ActorType(StrEnum):
    USER = "user"
    ADMIN = "admin"
    SYSTEM = "system"
    AGENT = "agent"


class TrackKind(StrEnum):
    REMOTE = "remote"
    INTERNATIONAL_SPONSORED = "international_sponsored"
    BANGLADESH_ONSITE = "bangladesh_onsite"
    BANGLADESH_GOVERNMENT = "bangladesh_government"
    CUSTOM = "custom"


class RequirementCheck(StrEnum):
    MET = "met"
    NOT_MET = "not_met"
    UNKNOWN = "unknown"


class SponsorshipEvidence(StrEnum):
    STATED = "stated"
    NOT_STATED = "not_stated"
    UNVERIFIED = "unverified"


class ProfileFieldType(StrEnum):
    TEXT = "text"
    TEXTAREA = "textarea"
    URL = "url"
    EMAIL = "email"
    PHONE = "phone"
    MONTH = "month"
    YEAR = "year"
    NUMBER = "number"
    SELECT = "select"
    BOOLEAN = "boolean"


class CompletenessKind(StrEnum):
    BASICS = "basics"
    PHOTO = "photo"
    CONTACTS = "contacts"
    SKILLS = "skills"
    DOCUMENTS = "documents"
    SECTION = "section"


class LanguageProficiency(StrEnum):
    NATIVE = "native"
    FLUENT = "fluent"
    PROFESSIONAL = "professional"
    INTERMEDIATE = "intermediate"
    BASIC = "basic"


class DocumentKind(StrEnum):
    CV = "cv"
    COVER_LETTER = "cover_letter"
    CERTIFICATE = "certificate"
    TRANSCRIPT = "transcript"
    IDENTITY = "identity"
    OTHER = "other"


class ThemeKey(StrEnum):
    SOBER = "sober"
    HORIZON = "horizon"
    ORCHID = "orchid"
