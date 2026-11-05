from pydantic import Field

from careerpilot.automation.enums import DeadlineAction, DryRunOutcome, SkipReason, SkipStage
from careerpilot.platform.enums import SubmissionWindowKind, Weekday
from careerpilot.platform.model import CamelModel
from careerpilot.portal.models import RulePermissions


class RuleFilters(CamelModel):
    min_match_score: int = 0
    allowed_routes: list[str] = Field(default_factory=list[str])
    countries: list[str] = Field(default_factory=list[str])
    excluded_employers: list[str] = Field(default_factory=list[str])
    excluded_keywords: list[str] = Field(default_factory=list[str])
    allow_unknown_requirements: bool = False


class RuleMaterials(CamelModel):
    cv_document_id: str | None = None


class RuleLimits(CamelModel):
    daily_cap: int | None = None
    weekly_cap: int | None = None
    total_cap: int | None = None
    expires_on: str | None = None


class RuleSchedule(CamelModel):
    kind: SubmissionWindowKind = SubmissionWindowKind.AS_SOON_AS_READY
    start: str | None = None
    end: str | None = None
    days: list[Weekday] = Field(default_factory=list[Weekday])


class AutomationRule(CamelModel):
    id: str
    name: str
    enabled: bool = True
    track_ids: list[str] = Field(default_factory=list[str])
    filters: RuleFilters = Field(default_factory=RuleFilters)
    materials: RuleMaterials = Field(default_factory=RuleMaterials)
    limits: RuleLimits = Field(default_factory=RuleLimits)
    schedule: RuleSchedule = Field(default_factory=RuleSchedule)
    portal: RulePermissions = Field(default_factory=RulePermissions)
    position: int = 0
    created_at: str
    updated_at: str
    deleted_at: str | None = None


class RuleInput(CamelModel):
    name: str
    enabled: bool = True
    track_ids: list[str] = Field(default_factory=list[str])
    filters: RuleFilters = Field(default_factory=RuleFilters)
    materials: RuleMaterials = Field(default_factory=RuleMaterials)
    limits: RuleLimits = Field(default_factory=RuleLimits)
    schedule: RuleSchedule = Field(default_factory=RuleSchedule)
    portal: RulePermissions = Field(default_factory=RulePermissions)


class SkippedRecord(CamelModel):
    opportunity_id: str
    title: str
    organization: str
    stage: SkipStage
    reasons: list[SkipReason]
    rule_id: str | None = None
    at: str


class AutomationSettings(CamelModel):
    rules: list[AutomationRule] = Field(default_factory=list[AutomationRule])
    deadline_buffer_hours: int | None = None
    deadline_action: DeadlineAction | None = None
    weekly_cap: int | None = None
    inactivity_days: int | None = None
    skipped: list[SkippedRecord] = Field(default_factory=list[SkippedRecord])

    def active_rules(self) -> list[AutomationRule]:
        return sorted((r for r in self.rules if r.deleted_at is None), key=lambda r: r.position)


class SettingsInput(CamelModel):
    deadline_buffer_hours: int | None = None
    deadline_action: DeadlineAction | None = None
    weekly_cap: int | None = None
    inactivity_days: int | None = None


class EffectiveSettings(CamelModel):
    deadline_buffer_hours: int
    deadline_action: DeadlineAction
    weekly_cap: int
    inactivity_days: int
    daily_cap: int


class AutomationLimits(CamelModel):
    max_rules: int
    default_min_match_score: int
    max_daily_cap: int
    max_weekly_cap: int
    max_total_cap: int
    min_inactivity_days: int
    max_inactivity_days: int
    max_deadline_buffer_hours: int
    max_list_items: int


class AutomationOverview(CamelModel):
    rules: list[AutomationRule]
    settings: EffectiveSettings
    holds: list[SkipReason]
    submitted_today: int
    submitted_this_week: int
    skipped: list[SkippedRecord]
    user_only_steps: list[str]
    limits: AutomationLimits


class DryRunMaterials(CamelModel):
    cv_name: str
    cv_version: int
    cover_letter: str
    answers: list[str]


class DryRunItem(CamelModel):
    opportunity_id: str
    title: str
    organization: str
    track_id: str
    match_score: int
    outcome: DryRunOutcome
    reasons: list[SkipReason]
    rule_id: str | None = None
    rule_name: str | None = None
    route: str
    materials: DryRunMaterials | None = None
    earliest_at: str | None = None
    bypasses_window: bool = False


class DryRunResult(CamelModel):
    ran_at: str
    rule_id: str | None = None
    holds: list[SkipReason]
    items: list[DryRunItem]
    would_apply: int
    deferred: int
    skipped: int
    submitted: int = 0
