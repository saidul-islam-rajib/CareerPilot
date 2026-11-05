import re
from datetime import date

from careerpilot.automation.config import AutomationConfig
from careerpilot.automation.models import AutomationLimits, AutomationRule, RuleInput, RuleSchedule, SettingsInput
from careerpilot.candidate.ports import CandidateWorkspace
from careerpilot.platform.config import Settings
from careerpilot.platform.enums import ApplicationRoute, SubmissionWindowKind
from careerpilot.platform.errors import validation_error
from careerpilot.platform.validation import require_text, require_time

COUNTRY_CODE = re.compile(r"[A-Z]{2}")
MIN_SCORE = 0
MAX_SCORE = 100
MIN_CAP = 1
MIN_BUFFER = 0


def limits_of(config: AutomationConfig) -> AutomationLimits:
    return AutomationLimits(
        max_rules=config.max_rules,
        default_min_match_score=config.default_min_match_score,
        max_daily_cap=config.max_daily_cap,
        max_weekly_cap=config.max_weekly_cap,
        max_total_cap=config.max_total_cap,
        min_inactivity_days=config.min_inactivity_days,
        max_inactivity_days=config.max_inactivity_days,
        max_deadline_buffer_hours=config.max_deadline_buffer_hours,
        max_list_items=config.max_list_items,
    )


def within(value: int | None, low: int, high: int) -> None:
    if value is not None and not low <= value <= high:
        raise validation_error("range")


def parse_date(value: str) -> date:
    try:
        return date.fromisoformat(value)
    except ValueError as error:
        raise validation_error("date") from error


class RuleValidator:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._config = settings.automation

    def check_settings(self, body: SettingsInput) -> None:
        config = self._config
        within(body.deadline_buffer_hours, MIN_BUFFER, config.max_deadline_buffer_hours)
        within(body.weekly_cap, MIN_CAP, config.max_weekly_cap)
        within(body.inactivity_days, config.min_inactivity_days, config.max_inactivity_days)

    def validated(self, workspace: CandidateWorkspace, body: RuleInput) -> AutomationRule:
        self._check_numbers(body)
        self._check_references(workspace, body)
        countries = self._countries(body.filters.countries)
        filters = body.filters.model_copy(
            update={
                "countries": countries,
                "excluded_employers": self._words(body.filters.excluded_employers),
                "excluded_keywords": self._words(body.filters.excluded_keywords),
            }
        )
        return AutomationRule(
            id="",
            name=require_text(body.name, self._settings.validation.name),
            enabled=body.enabled,
            track_ids=list(dict.fromkeys(body.track_ids)),
            filters=filters,
            materials=body.materials,
            limits=body.limits,
            schedule=self._schedule(body.schedule),
            portal=body.portal,
            created_at="",
            updated_at="",
        )

    def _check_numbers(self, body: RuleInput) -> None:
        config = self._config
        within(body.filters.min_match_score, MIN_SCORE, MAX_SCORE)
        within(body.limits.daily_cap, MIN_CAP, config.max_daily_cap)
        within(body.limits.weekly_cap, MIN_CAP, config.max_weekly_cap)
        within(body.limits.total_cap, MIN_CAP, config.max_total_cap)
        if body.limits.expires_on is not None:
            parse_date(body.limits.expires_on)

    def _check_references(self, workspace: CandidateWorkspace, body: RuleInput) -> None:
        known_tracks = {t.id for t in workspace.preferences.tracks}
        if any(t not in known_tracks for t in body.track_ids):
            raise validation_error("track")
        routes = {route.value for route in ApplicationRoute}
        if any(route not in routes for route in body.filters.allowed_routes):
            raise validation_error("route")
        cv_id = body.materials.cv_document_id
        if cv_id is not None and all(d.id != cv_id for d in workspace.profile.active_documents()):
            raise validation_error("cv_document")

    @staticmethod
    def _countries(values: list[str]) -> list[str]:
        codes = sorted({value.strip().upper() for value in values})
        if any(COUNTRY_CODE.fullmatch(code) is None for code in codes):
            raise validation_error("country_code")
        return codes

    @staticmethod
    def _schedule(schedule: RuleSchedule) -> RuleSchedule:
        days = list(dict.fromkeys(schedule.days))
        if schedule.kind is SubmissionWindowKind.DAILY_WINDOW:
            return RuleSchedule(kind=schedule.kind, start=require_time(schedule.start), end=require_time(schedule.end), days=days)
        return RuleSchedule(kind=schedule.kind, days=days)

    def _words(self, values: list[str]) -> list[str]:
        words: dict[str, str] = {}
        for value in values:
            text = value.strip()
            if not text or len(text) > self._config.max_item_length:
                raise validation_error("text")
            words.setdefault(text.casefold(), text)
        if len(words) > self._config.max_list_items:
            raise validation_error("list_limit")
        return list(words.values())
