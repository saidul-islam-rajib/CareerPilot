from enum import StrEnum


class HostPolicy(StrEnum):
    ALLOWED = "allowed"
    BLOCKED = "blocked"
    REVIEW = "review"


class RecordKind(StrEnum):
    ACCOUNT = "portal_account"
    ATTEMPT = "portal_attempt"
    SETTINGS = "portal_settings"
    HOST = "portal_host"
    READINESS = "portal_readiness"


class WallKind(StrEnum):
    NONE = "none"
    SIGN_IN = "sign_in"
    REGISTER = "register"


class PageKind(StrEnum):
    JOB = "job"
    FORM = "form"
    SIGN_IN = "sign_in"
    REGISTER = "register"
    VERIFICATION = "verification"
    CAPTCHA = "captcha"
    MFA = "mfa"
    IDENTITY = "identity"
    ASSESSMENT = "assessment"
    VIDEO = "video"
    PAYMENT = "payment"
    CLOSED = "closed"
    ALREADY_APPLIED = "already_applied"
    CONFIRMATION = "confirmation"
    ACCOUNT_EXISTS = "account_exists"
    SIGN_IN_FAILED = "sign_in_failed"
    UNKNOWN = "unknown"


class StopReason(StrEnum):
    CAPTCHA = "captcha"
    MFA = "mfa"
    IDENTITY = "identity"
    ATTESTATION = "attestation"
    UNKNOWN_QUESTION = "unknown_question"
    NO_EXACT_CHOICE = "no_exact_choice"
    DEMOGRAPHIC = "demographic"
    ASSESSMENT = "assessment"
    VIDEO = "video"
    PAYMENT = "payment"
    CLOSED = "closed"
    ALREADY_APPLIED = "already_applied"
    HOST_BLOCKED = "host_blocked"
    HOST_REVIEW = "host_review"
    AUTOPILOT_OFF = "autopilot_off"
    LIVE_SWITCH_OFF = "live_switch_off"
    ACCOUNT_CREATION_NOT_ALLOWED = "account_creation_not_allowed"
    ACCOUNT_EXISTS = "account_exists"
    LOGIN_FAILED = "login_failed"
    ACCOUNT_NEEDS_ATTENTION = "account_needs_attention"
    VERIFICATION_NEEDED = "verification_needed"
    SITE_CHANGED = "site_changed"
    NO_FORM = "no_form"
    MISSING_CV = "missing_cv"
    TERMS_NOT_ALLOWED = "terms_not_allowed"
    UNSUPPORTED_UPLOAD = "unsupported_upload"
    PAGE_LIMIT = "page_limit"
    NAVIGATION_FAILED = "navigation_failed"
    WALL_UNVERIFIED = "wall_unverified"
    CHECK_FAILED = "check_failed"


class FieldKind(StrEnum):
    TEXT = "text"
    EMAIL = "email"
    TEL = "tel"
    NUMBER = "number"
    TEXTAREA = "textarea"
    SELECT = "select"
    RADIO = "radio"
    CHECKBOX = "checkbox"
    FILE = "file"
    PASSWORD = "password"
    DATE = "date"
    OTHER = "other"


class FieldSource(StrEnum):
    PROFILE_FACT = "profile_fact"
    SAVED_ANSWER = "saved_answer"
    COVER_LETTER = "cover_letter"
    DOCUMENT = "document"
    CONSENT_RULE = "consent_rule"
    ACCOUNT = "account"


class FieldStatus(StrEnum):
    MAPPED = "mapped"
    CORRECTED = "corrected"
    SKIPPED = "skipped"
    UNKNOWN = "unknown"
    NO_EXACT_CHOICE = "no_exact_choice"
    DEMOGRAPHIC = "demographic"
    ATTESTATION = "attestation"
    UNSUPPORTED = "unsupported"
    TERMS_NOT_ALLOWED = "terms_not_allowed"


class Fact(StrEnum):
    FULL_NAME = "full_name"
    FIRST_NAME = "first_name"
    LAST_NAME = "last_name"
    EMAIL = "email"
    PHONE = "phone"
    LOCATION = "location"
    COUNTRY = "country"
    HEADLINE = "headline"
    SUMMARY = "summary"


class Verdict(StrEnum):
    CAN_AUTO_APPLY = "can_auto_apply"
    WILL_STOP = "will_stop"


class RunMode(StrEnum):
    READINESS = "readiness"
    LIVE = "live"


class AttemptState(StrEnum):
    STOPPED = "stopped"
    CONFIRMED = "confirmed"
    UNCERTAIN = "uncertain"
    FAILED = "failed"
    READINESS_ONLY = "readiness_only"


class AccountStatus(StrEnum):
    ACTIVE = "active"
    NEEDS_ATTENTION = "needs_attention"


class AccountOrigin(StrEnum):
    CREATED = "created"
    IMPORTED = "imported"


class ReadinessState(StrEnum):
    PENDING = "pending"
    DONE = "done"
    FAILED = "failed"


class Intent(StrEnum):
    DEMOGRAPHIC = "demographic"
    ATTESTATION = "attestation"
    CONSENT = "consent"
    PRIVACY = "privacy"
    TERMS = "terms"
    COVER_LETTER = "cover_letter"
    RESUME = "resume"
    EXPERIENCE = "experience"
    WORK_AUTHORIZATION = "work_authorization"
    SPONSORSHIP = "sponsorship"
    NOTICE_PERIOD = "notice_period"
    START_DATE = "start_date"
    SALARY_EXPECTATION = "salary_expectation"
    RELOCATION = "relocation"
    ELIGIBILITY = "eligibility"


class Failure(StrEnum):
    UNKNOWN_HOST = "unknown_host"
    NOT_FOUND = "portal_not_found"
    NOT_ENABLED = "autopilot_not_enabled"
    NOT_ACKNOWLEDGED = "summary_not_acknowledged"
    NOT_RESUMABLE = "attempt_not_resumable"
    ALREADY_SUBMITTED = "already_submitted"
    INVALID_HOST = "invalid_host"
    INVALID_URL = "invalid_url"
    DUPLICATE_ACCOUNT = "duplicate_account"


class FlowOutcome(StrEnum):
    CONFIRMED = "confirmed"
    STOPPED = "stopped"
    UNCERTAIN = "uncertain"
    READY = "ready"
