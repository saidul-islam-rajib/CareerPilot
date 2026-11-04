from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from careerpilot.government.models import (
    DayInfo,
    DeadlineNote,
    GradeInfo,
    Holiday,
    RecurringHoliday,
    Reference,
    RelaxationSuggestion,
)
from careerpilot.government.ports import HolidayRepository
from careerpilot.platform.clock import IdGenerator
from careerpilot.platform.config import GovernmentConfig
from careerpilot.platform.enums import DayKind, DeadlineSubject, Weekday
from careerpilot.platform.errors import not_found, validation_error

HOLIDAY_ID_PREFIX = "hol"
WEEKDAYS = tuple(Weekday)
SEARCH_DAYS = 60
TIME_FORMAT = "%H:%M"
REMOVE_REASON = "removed by an administrator"
NAME_REQUIRED = "holiday_name"


def clock_time(value: str) -> time:
    return datetime.strptime(value, TIME_FORMAT).time()


class WorkCalendar:
    def __init__(self, config: GovernmentConfig, holidays: HolidayRepository, ids: IdGenerator) -> None:
        self._cfg = config
        self._holidays = holidays
        self._ids = ids
        self._zone = ZoneInfo(config.time_zone)
        self._weekend = set(config.office.weekend_days)
        self._start = clock_time(config.office.start)
        self._end = clock_time(config.office.end)

    def day(self, on: date) -> DayInfo:
        for holiday in self._holidays.between(on, on):
            return DayInfo(on=on, kind=DayKind.HOLIDAY, name=holiday.name)
        for recurring in self._cfg.recurring_holidays:
            if (recurring.month, recurring.day) == (on.month, on.day):
                return DayInfo(on=on, kind=DayKind.HOLIDAY, name=recurring.name)
        if WEEKDAYS[on.weekday()] in self._weekend:
            return DayInfo(on=on, kind=DayKind.WEEKEND)
        return DayInfo(on=on, kind=DayKind.WORKING)

    def is_working(self, on: date) -> bool:
        return self.day(on).kind is DayKind.WORKING

    def previous_working(self, on: date) -> date | None:
        return self._search(on, -1)

    def next_working(self, on: date) -> date | None:
        return self._search(on, 1)

    def _search(self, on: date, step: int) -> date | None:
        for offset in range(1, SEARCH_DAYS + 1):
            candidate = on + timedelta(days=step * offset)
            if self.is_working(candidate):
                return candidate
        return None

    def within_office_hours(self, moment: datetime) -> bool:
        local = moment.astimezone(self._zone)
        return self.is_working(local.date()) and self._start <= local.time() <= self._end

    def note(self, subject: DeadlineSubject, on: date, at: time | None = None) -> DeadlineNote:
        info = self.day(on)
        working = info.kind is DayKind.WORKING
        outside = at is not None and working and not (self._start <= at <= self._end)
        return DeadlineNote(
            subject=subject,
            on=on,
            kind=info.kind,
            holiday_name=info.name,
            outside_office_hours=outside,
            previous_working_day=None if working else self.previous_working(on),
            next_working_day=None if working else self.next_working(on),
        )

    def local_date(self, moment: datetime) -> date:
        return moment.astimezone(self._zone).date()

    def local_time(self, moment: datetime) -> time:
        return moment.astimezone(self._zone).time()

    def list_holidays(self) -> list[Holiday]:
        return self._holidays.list_all()

    def add_holiday(self, on: date, name: str) -> Holiday:
        clean = name.strip()
        if not clean or len(clean) > self._cfg.limits.max_name_chars:
            raise validation_error(NAME_REQUIRED)
        holiday = Holiday(id=self._ids.next(HOLIDAY_ID_PREFIX), on=on, name=clean)
        self._holidays.add(holiday)
        return holiday

    def remove_holiday(self, holiday_id: str) -> None:
        if not any(h.id == holiday_id for h in self._holidays.list_all()):
            raise not_found("holiday")
        self._holidays.remove(holiday_id, REMOVE_REASON)

    def reference(self) -> Reference:
        cfg = self._cfg
        return Reference(
            currency=cfg.currency,
            time_zone=cfg.time_zone,
            grades=[GradeInfo(**grade.model_dump()) for grade in cfg.grades],
            holidays=self.list_holidays(),
            recurring_holidays=[RecurringHoliday(**item.model_dump()) for item in cfg.recurring_holidays],
            weekend_days=[day.value for day in cfg.office.weekend_days],
            office_start=cfg.office.start,
            office_end=cfg.office.end,
            relaxation_suggestions=[RelaxationSuggestion(**item.model_dump()) for item in cfg.age.relaxation_suggestions],
            default_max_age=cfg.age.default_max_years,
            copy_types=cfg.limits.copy_types,
            copy_max_bytes=cfg.limits.copy_max_bytes,
        )
