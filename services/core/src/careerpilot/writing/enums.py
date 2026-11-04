from enum import StrEnum


class WritingKind(StrEnum):
    COVER_LETTER = "cover_letter"
    TAILORED_CV = "tailored_cv"
    ESSAY = "essay"
    STATEMENT = "statement"


class DraftSource(StrEnum):
    TEMPLATE = "template"
    AI = "ai"
    USER = "user"


class WritingTone(StrEnum):
    PROFESSIONAL = "professional"
    FRIENDLY = "friendly"
    CONCISE = "concise"


class WritingMode(StrEnum):
    AUTO = "auto"
    TEMPLATE = "template"


class IssueKind(StrEnum):
    UNSUPPORTED_CLAIM = "unsupported_claim"
    OTHER_EMPLOYER = "other_employer"
    PLACEHOLDER = "placeholder"
    MISSING_TARGET = "missing_target"
    OVER_LIMIT = "over_limit"
    EMPTY = "empty"


class DraftStatus(StrEnum):
    READY = "ready"
    NEEDS_FIXES = "needs_fixes"


class WritingProvider(StrEnum):
    TEMPLATE = "template"
    AI = "ai"


class WritingFailure(StrEnum):
    AI_NOT_CONFIGURED = "ai_not_configured"
    AI_UNAVAILABLE = "ai_unavailable"
    AI_REFUSED = "ai_refused"
    HAS_ISSUES = "has_issues"
    APPROVAL_CLOSED = "approval_closed"
    OPPORTUNITY_MISMATCH = "opportunity_mismatch"
    VERSION_LIMIT = "version_limit"
    NOTHING_TO_WRITE = "nothing_to_write"
    TEXT = "text"
    INSTRUCTIONS = "instructions"
