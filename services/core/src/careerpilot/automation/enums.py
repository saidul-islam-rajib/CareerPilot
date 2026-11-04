from enum import StrEnum


class DeadlineAction(StrEnum):
    NOTIFY_AND_ASK = "notify_and_ask"
    SUBMIT_EARLIEST = "submit_earliest"
    SKIP = "skip"


class DryRunOutcome(StrEnum):
    WOULD_APPLY = "would_apply"
    DEFERRED = "deferred"
    SKIPPED = "skipped"


class SkipReason(StrEnum):
    EMERGENCY_STOP = "emergency_stop"
    PAUSED = "paused"
    INACTIVE = "inactive"
    TRACK_NOT_AUTOMATIC = "track_not_automatic"
    HARD_REQUIREMENT_FAILED = "hard_requirement_failed"
    UNKNOWN_REQUIREMENT = "unknown_requirement"
    EXCLUDED_COUNTRY = "excluded_country"
    NO_MATCHING_RULE = "no_matching_rule"
    BELOW_SCORE = "below_score"
    COUNTRY_NOT_ALLOWED = "country_not_allowed"
    ROUTE_NOT_ALLOWED = "route_not_allowed"
    EXCLUDED_EMPLOYER = "excluded_employer"
    EXCLUDED_KEYWORD = "excluded_keyword"
    RULE_EXPIRED = "rule_expired"
    USER_ONLY_STEP = "user_only_step"
    CV_MISSING = "cv_missing"
    DEADLINE_AT_RISK = "deadline_at_risk"
    DEADLINE_PASSED = "deadline_passed"
    DAILY_CAP = "daily_cap"
    WEEKLY_CAP = "weekly_cap"
    RULE_CAP = "rule_cap"
    OUTSIDE_WINDOW = "outside_window"


class SkipStage(StrEnum):
    RULE = "rule"
    SAFEGUARD = "safeguard"
    SCHEDULE = "schedule"
