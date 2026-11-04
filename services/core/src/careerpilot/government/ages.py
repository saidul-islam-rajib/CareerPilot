from dataclasses import dataclass
from datetime import date

MARCH = 3
FIRST = 1
MONTHS_PER_YEAR = 12


@dataclass(frozen=True)
class Age:
    years: int
    months: int
    days: int

    def text(self) -> str:
        return f"{self.years}y {self.months}m {self.days}d"


def anniversary(born: date, years: int) -> date:
    try:
        return born.replace(year=born.year + years)
    except ValueError:
        return date(born.year + years, MARCH, FIRST)


def _month_length(year: int, month: int) -> int:
    following = date(year + month // MONTHS_PER_YEAR, month % MONTHS_PER_YEAR + 1, FIRST)
    return (following - date(year, month, FIRST)).days


def _add_months(start: date, months: int) -> date:
    year, month_index = divmod(start.year * MONTHS_PER_YEAR + start.month - 1 + months, MONTHS_PER_YEAR)
    month = month_index + 1
    return date(year, month, min(start.day, _month_length(year, month)))


def age_on(born: date, as_of: date) -> Age:
    years = as_of.year - born.year
    if anniversary(born, years) > as_of:
        years -= 1
    last = anniversary(born, years)
    months = 0
    while months < MONTHS_PER_YEAR - 1 and _add_months(last, months + 1) <= as_of:
        months += 1
    return Age(years=years, months=months, days=(as_of - _add_months(last, months)).days)


def within_maximum(born: date, as_of: date, max_years: int) -> bool:
    return as_of <= anniversary(born, max_years)


def reached_minimum(born: date, as_of: date, min_years: int) -> bool:
    return as_of >= anniversary(born, min_years)
