from dataclasses import dataclass
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

from careerpilot.administration.models import EmergencyStop, PlatformSettings
from careerpilot.automation.config import AutomationConfig
from careerpilot.automation.enums import DeadlineAction, SkipReason, SkipStage
from careerpilot.automation.models import AutomationRule, AutomationSettings, EffectiveSettings, RuleSchedule
from careerpilot.automation.timing import all_open, day_start, deadline_at_risk, next_open, week_start
from careerpilot.candidate.models import ApplicationRecord, OpportunityDetail, OpportunityMatch, Track
from careerpilot.candidate.ports import CandidateWorkspace
from careerpilot.platform.clock import parse_iso
from careerpilot.platform.enums import (
    ApplicationMode,
    EmergencyStopScope,
    PauseScope,
    RequirementCheck,
    SubmissionWindowKind,
)


@dataclass(frozen=True)
class Situation:
    workspace: CandidateWorkspace
    platform: PlatformSettings
    now: datetime

    @property
    def zone(self) -> ZoneInfo:
        return ZoneInfo(self.workspace.preferences.time_zone)


@dataclass(frozen=True)
class Candidate:
    opportunity: OpportunityDetail
    match: OpportunityMatch
    track: Track


@dataclass(frozen=True)
class Verdict:
    rule: AutomationRule | None
    reasons: list[SkipReason]
    stage: SkipStage = SkipStage.RULE

    @property
    def accepted(self) -> bool:
        return not self.reasons


def emergency_stopped(stop: EmergencyStop, route: str | None) -> bool:
    if not stop.active:
        return False
    if stop.scope in (None, EmergencyStopScope.ALL_USERS):
        return True
    return stop.scope is EmergencyStopScope.ROUTE and (route is None or stop.target == route)


def is_paused(workspace: CandidateWorkspace, now: datetime) -> bool:
    pause = workspace.preferences.pause
    return pause is not None and pause.scope is PauseScope.ALL and (pause.until is None or parse_iso(pause.until) > now)


def last_active(workspace: CandidateWorkspace) -> datetime | None:
    moments = [parse_iso(e.at) for e in workspace.sign_in_events if e.success]
    return max(moments) if moments else None


def global_schedule(workspace: CandidateWorkspace) -> RuleSchedule:
    window = workspace.preferences.submission_window
    if window.kind is SubmissionWindowKind.DAILY_WINDOW:
        return RuleSchedule(kind=window.kind, start=window.start, end=window.end)
    return RuleSchedule()


def contains_any(text: str, needles: list[str]) -> bool:
    lowered = text.casefold()
    return any(needle.casefold() in lowered for needle in needles)


def rule_expired(rule: AutomationRule, situation: Situation) -> bool:
    if rule.limits.expires_on is None:
        return False
    return date.fromisoformat(rule.limits.expires_on) < situation.now.astimezone(situation.zone).date()


def rule_unusable(rule: AutomationRule | None, situation: Situation) -> bool:
    return rule is None or rule.deleted_at is not None or not rule.enabled or rule_expired(rule, situation)


class AutomationPolicy:
    def __init__(self, config: AutomationConfig, automatable_routes: list[str]) -> None:
        self._config = config
        self._routes = frozenset(automatable_routes)

    def effective(self, settings: AutomationSettings, platform: PlatformSettings) -> EffectiveSettings:
        config = self._config
        buffer = config.default_deadline_buffer_hours if settings.deadline_buffer_hours is None else settings.deadline_buffer_hours
        return EffectiveSettings(
            deadline_buffer_hours=buffer,
            deadline_action=settings.deadline_action or config.default_deadline_action,
            weekly_cap=min(settings.weekly_cap or config.default_weekly_cap, config.max_weekly_cap),
            inactivity_days=settings.inactivity_days or config.default_inactivity_days,
            daily_cap=platform.daily_application_cap,
        )

    def settings_of(self, situation: Situation) -> EffectiveSettings:
        return self.effective(situation.workspace.preferences.automation, situation.platform)

    def account_holds(self, situation: Situation, route: str | None = None) -> list[SkipReason]:
        active = last_active(situation.workspace)
        limit = timedelta(days=self.settings_of(situation).inactivity_days)
        checks = [
            (emergency_stopped(situation.platform.emergency_stop, route), SkipReason.EMERGENCY_STOP),
            (is_paused(situation.workspace, situation.now), SkipReason.PAUSED),
            (active is not None and situation.now - active > limit, SkipReason.INACTIVE),
        ]
        return [reason for blocked, reason in checks if blocked]

    def verdict(self, situation: Situation, candidate: Candidate, only_rule: str | None = None) -> Verdict:
        safeguards = self._safeguards(situation, candidate)
        if safeguards:
            return Verdict(None, safeguards, SkipStage.SAFEGUARD)
        unknown = any(r.hard and r.check == RequirementCheck.UNKNOWN.value for r in candidate.match.requirements)
        every = situation.workspace.preferences.automation.active_rules()
        rules = [r for r in every if r.id == only_rule or (only_rule is None and r.enabled)]
        if not rules:
            return Verdict(None, [SkipReason.UNKNOWN_REQUIREMENT] if unknown else [])
        covering = [r for r in rules if not r.track_ids or candidate.track.id in r.track_ids]
        blocked = self._blocked(covering, candidate.opportunity)
        if blocked:
            return Verdict(None, blocked)
        outcomes = [(rule, self._rule_reasons(situation, rule, candidate, unknown)) for rule in covering]
        accepted = next((rule for rule, reasons in outcomes if not reasons), None)
        if accepted is not None:
            return Verdict(accepted, [])
        return Verdict(None, outcomes[0][1] if outcomes else [SkipReason.NO_MATCHING_RULE])

    def _safeguards(self, situation: Situation, candidate: Candidate) -> list[SkipReason]:
        opportunity = candidate.opportunity
        deadline = opportunity.deadline
        workspace = situation.workspace
        checks = [
            (candidate.match.has_hard_failure, SkipReason.HARD_REQUIREMENT_FAILED),
            (opportunity.country_code in workspace.preferences.excluded_countries, SkipReason.EXCLUDED_COUNTRY),
            (candidate.track.mode is not ApplicationMode.AUTOMATIC, SkipReason.TRACK_NOT_AUTOMATIC),
            (deadline is not None and parse_iso(deadline) <= situation.now, SkipReason.DEADLINE_PASSED),
            (not workspace.profile.active_documents(), SkipReason.CV_MISSING),
        ]
        return [reason for failed, reason in checks if failed]

    def user_only(self, route: str) -> bool:
        return route not in self._routes

    def _blocked(self, rules: list[AutomationRule], opportunity: OpportunityDetail) -> list[SkipReason]:
        text = f"{opportunity.title} {opportunity.description}"
        reasons: list[SkipReason] = []
        if any(contains_any(opportunity.organization, r.filters.excluded_employers) for r in rules):
            reasons.append(SkipReason.EXCLUDED_EMPLOYER)
        if any(contains_any(text, r.filters.excluded_keywords) for r in rules):
            reasons.append(SkipReason.EXCLUDED_KEYWORD)
        return reasons

    def _rule_reasons(self, situation: Situation, rule: AutomationRule, candidate: Candidate, unknown: bool) -> list[SkipReason]:
        filters = rule.filters
        opportunity = candidate.opportunity
        cv_id = rule.materials.cv_document_id
        documents = situation.workspace.profile.active_documents()
        checks = [
            (rule_expired(rule, situation), SkipReason.RULE_EXPIRED),
            (candidate.match.score < filters.min_match_score, SkipReason.BELOW_SCORE),
            (bool(filters.countries) and opportunity.country_code not in filters.countries, SkipReason.COUNTRY_NOT_ALLOWED),
            (bool(filters.allowed_routes) and opportunity.route not in filters.allowed_routes, SkipReason.ROUTE_NOT_ALLOWED),
            (unknown and not filters.allow_unknown_requirements, SkipReason.UNKNOWN_REQUIREMENT),
            (cv_id is not None and all(d.id != cv_id for d in documents), SkipReason.CV_MISSING),
        ]
        return [reason for failed, reason in checks if failed]

    def schedules(self, workspace: CandidateWorkspace, rule: AutomationRule | None) -> list[RuleSchedule]:
        return [global_schedule(workspace), *([rule.schedule] if rule else [])]

    def schedule_open(self, situation: Situation, rule: AutomationRule | None) -> bool:
        return all_open(self.schedules(situation.workspace, rule), situation.zone, situation.now)

    def timing_risk(self, situation: Situation, rule: AutomationRule | None, deadline: str | None) -> bool:
        if not deadline:
            return False
        buffer = timedelta(hours=self.settings_of(situation).deadline_buffer_hours)
        cutoff = parse_iso(deadline) - buffer
        schedules = self.schedules(situation.workspace, rule)
        return deadline_at_risk(schedules, situation.zone, situation.now, cutoff, self._config.window_lookahead_days)

    def earliest(self, situation: Situation, rule: AutomationRule | None) -> datetime | None:
        schedules = self.schedules(situation.workspace, rule)
        return next_open(schedules, situation.zone, situation.now, self._config.window_lookahead_days)

    def counts(self, situation: Situation, rule_id: str | None) -> tuple[int, int, int]:
        today, week = day_start(situation.now, situation.zone), week_start(situation.now, situation.zone)
        applications = situation.workspace.applications
        applied = [parse_iso(a.applied_at) for a in applications if a.applied_at and (rule_id is None or a.rule_id == rule_id)]
        return sum(1 for m in applied if m >= today), sum(1 for m in applied if m >= week), len(applied)

    def cap_reason(self, situation: Situation, rule: AutomationRule | None, planned: int = 0, rule_planned: int = 0) -> SkipReason | None:
        effective = self.settings_of(situation)
        today, week, _ = self.counts(situation, None)
        if today + planned >= effective.daily_cap:
            return SkipReason.DAILY_CAP
        if week + planned >= effective.weekly_cap:
            return SkipReason.WEEKLY_CAP
        if rule is None:
            return None
        rule_today, rule_week, rule_total = self.counts(situation, rule.id)
        limits = rule.limits
        exceeded = [
            limits.daily_cap is not None and rule_today + rule_planned >= limits.daily_cap,
            limits.weekly_cap is not None and rule_week + rule_planned >= limits.weekly_cap,
            limits.total_cap is not None and rule_total + rule_planned >= limits.total_cap,
        ]
        return SkipReason.RULE_CAP if any(exceeded) else None

    def rule_of(self, workspace: CandidateWorkspace, application: ApplicationRecord) -> AutomationRule | None:
        return next((r for r in workspace.preferences.automation.rules if r.id == application.rule_id), None)

    def action(self, situation: Situation) -> DeadlineAction:
        return self.settings_of(situation).deadline_action
