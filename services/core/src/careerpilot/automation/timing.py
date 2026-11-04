from datetime import datetime, time, timedelta
from zoneinfo import ZoneInfo

from careerpilot.automation.models import RuleSchedule
from careerpilot.platform.enums import SubmissionWindowKind, Weekday

TIME_SEPARATOR = ":"
MIDNIGHT = time(0, 0)
WEEKDAYS = tuple(Weekday)


def parse_time(value: str | None) -> time | None:
    if not value:
        return None
    hours, minutes = value.split(TIME_SEPARATOR, 1)
    return time(int(hours), int(minutes))


def time_in_window(local: time, start: time, end: time) -> bool:
    return start <= local < end if start <= end else local >= start or local < end


def schedule_open(schedule: RuleSchedule, zone: ZoneInfo, moment: datetime) -> bool:
    local = moment.astimezone(zone)
    if schedule.days and WEEKDAYS[local.weekday()] not in schedule.days:
        return False
    if schedule.kind is SubmissionWindowKind.AS_SOON_AS_READY:
        return True
    start, end = parse_time(schedule.start), parse_time(schedule.end)
    return True if start is None or end is None else time_in_window(local.time(), start, end)


def all_open(schedules: list[RuleSchedule], zone: ZoneInfo, moment: datetime) -> bool:
    return all(schedule_open(schedule, zone, moment) for schedule in schedules)


def next_open(schedules: list[RuleSchedule], zone: ZoneInfo, now: datetime, lookahead_days: int) -> datetime | None:
    if all_open(schedules, zone, now):
        return now
    local = now.astimezone(zone)
    starts = [MIDNIGHT, *(parse_time(schedule.start) or MIDNIGHT for schedule in schedules)]
    candidates = {
        datetime.combine((local + timedelta(days=offset)).date(), start, tzinfo=zone)
        for offset in range(lookahead_days + 1)
        for start in starts
    }
    return next((c for c in sorted(candidates) if c > now and all_open(schedules, zone, c)), None)


def deadline_at_risk(schedules: list[RuleSchedule], zone: ZoneInfo, now: datetime, cutoff: datetime, lookahead_days: int) -> bool:
    opening = next_open(schedules, zone, now, lookahead_days)
    return opening is None or opening > cutoff


def day_start(moment: datetime, zone: ZoneInfo) -> datetime:
    local = moment.astimezone(zone)
    return datetime.combine(local.date(), MIDNIGHT, tzinfo=zone)


def week_start(moment: datetime, zone: ZoneInfo) -> datetime:
    return day_start(moment, zone) - timedelta(days=moment.astimezone(zone).weekday())
