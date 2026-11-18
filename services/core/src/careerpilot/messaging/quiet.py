from datetime import datetime, time
from zoneinfo import ZoneInfo

from careerpilot.candidate.models import HeldPush, NotificationPreferences
from careerpilot.candidate.ports import WorkspaceRepository
from careerpilot.platform.clock import Clock
from careerpilot.reminders.config import QuietHoursConfig

TIME_SEPARATOR = ":"


def parse_time(value: str) -> time:
    hours, minutes = value.split(TIME_SEPARATOR, 1)
    return time(int(hours), int(minutes))


def inside_window(now: time, start: time, end: time) -> bool:
    if start == end:
        return False
    if start < end:
        return start <= now < end
    return now >= start or now < end


class QuietHoursGate:
    def __init__(self, workspaces: WorkspaceRepository, clock: Clock, config: QuietHoursConfig) -> None:
        self._workspaces = workspaces
        self._clock = clock
        self._config = config

    def is_quiet(self, preferences: NotificationPreferences, zone: str, now: datetime) -> bool:
        if not preferences.quiet_hours_enabled:
            return False
        start = parse_time(preferences.quiet_start or self._config.default_start)
        end = parse_time(preferences.quiet_end or self._config.default_end)
        return inside_window(now.astimezone(ZoneInfo(zone)).time(), start, end)

    def hold(self, user_id: str, push: HeldPush) -> bool:
        workspace = self._workspaces.get(user_id)
        preferences = workspace.preferences.notifications
        if not self.is_quiet(preferences, workspace.preferences.time_zone, self._clock.now()):
            return False
        if push.kind in self._config.urgent_kinds and preferences.urgent_overrides_quiet:
            return False
        workspace.held_pushes.append(push)
        self._workspaces.save(user_id, workspace)
        return True

    def release(self, user_id: str) -> list[HeldPush]:
        workspace = self._workspaces.get(user_id)
        if not workspace.held_pushes:
            return []
        if self.is_quiet(workspace.preferences.notifications, workspace.preferences.time_zone, self._clock.now()):
            return []
        released = workspace.held_pushes
        workspace.held_pushes = []
        self._workspaces.save(user_id, workspace)
        return released
