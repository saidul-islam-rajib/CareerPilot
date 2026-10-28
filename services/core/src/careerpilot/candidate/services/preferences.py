import re
from datetime import datetime, timedelta

from careerpilot.candidate.context import CandidateContext, ChangeListener, ignore_change
from careerpilot.candidate.models import (
    DeletionRequest,
    NotificationPreferences,
    PauseState,
    Preferences,
    SignInEvent,
    SubmissionWindow,
    Track,
)
from careerpilot.platform.clock import iso
from careerpilot.platform.enums import ApplicationMode, PauseDuration, PauseScope, SubmissionWindowKind
from careerpilot.platform.errors import not_found, validation_error
from careerpilot.platform.validation import require_result_count, require_time

MONTHS_PER_YEAR = 12
COUNTRY_CODE = re.compile(r"[A-Z]{2}")
FIRST_MONTH = 1


def add_months(moment: datetime, months: int) -> datetime:
    month_index = moment.month - FIRST_MONTH + months
    year = moment.year + month_index // MONTHS_PER_YEAR
    month = month_index % MONTHS_PER_YEAR + FIRST_MONTH
    return moment.replace(year=year, month=month)


def pause_until(now: datetime, duration: PauseDuration, amount: int | None) -> datetime | None:
    if duration is PauseDuration.DAYS:
        return now + timedelta(days=amount or 0)
    if duration is PauseDuration.MONTHS:
        return add_months(now, amount or 0)
    if duration is PauseDuration.YEARS:
        return add_months(now, (amount or 0) * MONTHS_PER_YEAR)
    return None


class PreferencesService:
    def __init__(self, context: CandidateContext, on_change: ChangeListener = ignore_change) -> None:
        self._ctx = context
        self._on_change = on_change

    def get(self, user_id: str) -> Preferences:
        return self._view(self._ctx.workspaces.get(user_id).preferences)

    def _view(self, preferences: Preferences) -> Preferences:
        notifications = preferences.notifications
        effective = notifications.digest_time or self._ctx.settings.notifications.default_digest_time
        return preferences.model_copy(update={"notifications": notifications.model_copy(update={"digest_time": effective})})

    def update_track(self, user_id: str, track_id: str, result_count: int | None, mode: ApplicationMode | None) -> Track:
        workspace = self._ctx.workspaces.get(user_id)
        track = next((t for t in workspace.preferences.tracks if t.id == track_id), None)
        if track is None:
            raise not_found("track")
        if result_count is not None:
            track.result_count = require_result_count(result_count, self._ctx.settings.validation.track)
        if mode is not None:
            track.mode = mode
        self._ctx.workspaces.save(user_id, workspace)
        self._on_change(user_id)
        return track

    def pause(self, user_id: str, duration: PauseDuration, amount: int | None) -> Preferences:
        allowed = {(o.duration, o.amount) for o in self._ctx.settings.account.pause_options}
        if (duration, amount) not in allowed:
            raise validation_error("pause_option")
        now = self._ctx.clock.now()
        until = pause_until(now, duration, amount)
        workspace = self._ctx.workspaces.get(user_id)
        workspace.preferences.pause = PauseState(scope=PauseScope.ALL, started_at=iso(now), until=iso(until) if until else None)
        self._ctx.workspaces.save(user_id, workspace)
        return self._view(workspace.preferences)

    def resume(self, user_id: str) -> Preferences:
        workspace = self._ctx.workspaces.get(user_id)
        workspace.preferences.pause = None
        self._ctx.workspaces.save(user_id, workspace)
        return self._view(workspace.preferences)

    def update_notifications(self, user_id: str, digest_enabled: bool | None, digest_time: str | None) -> Preferences:
        workspace = self._ctx.workspaces.get(user_id)
        current = workspace.preferences.notifications
        workspace.preferences.notifications = NotificationPreferences(
            digest_enabled=current.digest_enabled if digest_enabled is None else digest_enabled,
            digest_time=current.digest_time if digest_time is None else require_time(digest_time),
        )
        self._ctx.workspaces.save(user_id, workspace)
        return self._view(workspace.preferences)

    def update_submission_window(self, user_id: str, window: SubmissionWindow) -> Preferences:
        if window.kind is SubmissionWindowKind.DAILY_WINDOW:
            window = SubmissionWindow(kind=window.kind, start=require_time(window.start), end=require_time(window.end))
        else:
            window = SubmissionWindow(kind=window.kind)
        workspace = self._ctx.workspaces.get(user_id)
        workspace.preferences.submission_window = window
        self._ctx.workspaces.save(user_id, workspace)
        return self._view(workspace.preferences)

    def update_excluded_countries(self, user_id: str, countries: list[str]) -> Preferences:
        codes = sorted({code.strip().upper() for code in countries if code.strip()})
        if any(COUNTRY_CODE.fullmatch(code) is None for code in codes):
            raise validation_error("country_code")
        workspace = self._ctx.workspaces.get(user_id)
        workspace.preferences.excluded_countries = codes
        self._ctx.workspaces.save(user_id, workspace)
        self._on_change(user_id)
        return self._view(self._ctx.workspaces.get(user_id).preferences)

    def sign_in_activity(self, user_id: str) -> list[SignInEvent]:
        return sorted(self._ctx.workspaces.get(user_id).sign_in_events, key=lambda e: e.at, reverse=True)

    def request_account_deletion(self, user_id: str) -> DeletionRequest:
        workspace = self._ctx.workspaces.get(user_id)
        scheduled = iso(self._ctx.clock.now() + timedelta(days=self._ctx.settings.account.deletion_grace_days))
        workspace.deletion_scheduled_for = scheduled
        self._ctx.workspaces.save(user_id, workspace)
        return DeletionRequest(scheduled_for=scheduled)
