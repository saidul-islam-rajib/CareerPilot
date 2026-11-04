import calendar
from datetime import date


def add_months(start: date, months: int) -> date:
    index = start.month - 1 + months
    year = start.year + index // 12
    month = index % 12 + 1
    return date(year, month, min(start.day, calendar.monthrange(year, month)[1]))
