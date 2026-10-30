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


class TaskKind(StrEnum):
    FOLLOW_UP = "follow_up"
    INTERVIEW = "interview"
    ASSESSMENT = "assessment"
    REFERENCE = "reference"
    COMMUNICATION = "communication"
    OTHER = "other"


class TaskStatus(StrEnum):
    OPEN = "open"
    DONE = "done"
    DISMISSED = "dismissed"


class TimelineActor(StrEnum):
    SYSTEM = "system"
    USER = "user"
    EMPLOYER = "employer"
    ADMIN = "admin"


class AnswerSource(StrEnum):
    PROFILE = "profile"
    AI = "ai"
    USER = "user"
    SAVED = "saved"


class AnswerTopic(StrEnum):
    WORK_AUTHORIZATION = "work_authorization"
    SPONSORSHIP = "sponsorship"
    NOTICE_PERIOD = "notice_period"
    START_DATE = "start_date"
    SALARY_EXPECTATION = "salary_expectation"
    RELOCATION = "relocation"
    EXPERIENCE = "experience"
    ELIGIBILITY = "eligibility"
    OTHER = "other"


class ApplicationFilter(StrEnum):
    ALL = "all"
    ACTIVE = "active"
    SUBMITTED = "submitted"
    ATTENTION = "attention"


class ContactKind(StrEnum):
    EMAIL = "email"
    PHONE = "phone"


class AccountLinkPurpose(StrEnum):
    SETUP = "setup"
    RESET = "reset"


class UserAccountStatus(StrEnum):
    REGISTERED = "registered"
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


class SourceQueryKind(StrEnum):
    LINK = "link"
    EMAIL = "email"
    NAME = "name"


class SourceReview(StrEnum):
    APPROVED = "approved"
    PENDING = "pending"
    REJECTED = "rejected"


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


class OpportunityType(StrEnum):
    JOB = "job"
    GOVERNMENT_JOB = "government_job"
    MASTERS = "masters"
    PHD = "phd"
    SCHOLARSHIP = "scholarship"
    INTERNSHIP = "internship"


class WorkArrangement(StrEnum):
    REMOTE = "remote"
    HYBRID = "hybrid"
    ONSITE = "onsite"
    NOT_STATED = "not_stated"


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


class ApplicationRoute(StrEnum):
    EMAIL = "email"
    ATS_PORTAL = "ats_portal"
    EMPLOYER_PORTAL = "employer_portal"
    GOVERNMENT_PORTAL = "government_portal"
    GUIDED_MANUAL = "guided_manual"


class DeliveryMode(StrEnum):
    SANDBOX = "sandbox"
    LIVE = "live"


class SmtpSecurity(StrEnum):
    NONE = "none"
    STARTTLS = "starttls"
    TLS = "tls"


class AccountEmail(StrEnum):
    SETUP = "setup"
    RESET = "reset"
    EXISTING = "existing"


class CheckFailure(StrEnum):
    MISSING_DOCUMENT = "missing_document"
    UNREADABLE_DOCUMENT = "unreadable_document"
    MISSING_RECIPIENT = "missing_recipient"
    INVALID_RECIPIENT = "invalid_recipient"
    MISSING_CONTACT = "missing_contact"
    PLACEHOLDER_TEXT = "placeholder_text"
    WRONG_TARGET = "wrong_target"
    OTHER_EMPLOYER_TEXT = "other_employer_text"
    DEADLINE_PASSED = "deadline_passed"
    ALREADY_APPLIED = "already_applied"


class SubmissionHold(StrEnum):
    EMERGENCY_STOP = "emergency_stop"
    PAUSED = "paused"
    OUTSIDE_WINDOW = "outside_window"
    DAILY_LIMIT = "daily_limit"


class ThemeKey(StrEnum):
    SOBER = "sober"
    HORIZON = "horizon"
    ORCHID = "orchid"


class NotificationKind(StrEnum):
    MESSAGE = "message"
    TEAM_MESSAGE = "team_message"
    APPLICATION_SUBMITTED = "application_submitted"
    APPLICATION_CONFIRMED = "application_confirmed"


class NotificationTarget(StrEnum):
    CONVERSATION = "conversation"
    APPLICATION = "application"


class ConversationKind(StrEnum):
    DIRECT = "direct"
    TEAM = "team"


class MemberType(StrEnum):
    USER = "user"
    TEAM = "team"


class MessageKind(StrEnum):
    TEXT = "text"
    IMAGE = "image"
    VOICE = "voice"
    FILE = "file"


class MessageState(StrEnum):
    SENT = "sent"
    DELIVERED = "delivered"
    READ = "read"


class DevicePlatform(StrEnum):
    ANDROID = "android"
    IOS = "ios"


class PushMode(StrEnum):
    EXPO = "expo"
    OFF = "off"
