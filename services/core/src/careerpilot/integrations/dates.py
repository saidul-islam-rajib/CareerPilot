import re
from datetime import date, datetime, time
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from careerpilot.platform.config import DatesConfig

TOKEN = re.compile(r"[\w:.\-]+")
ORDINAL = re.compile(r"^(\d{1,2})(st|nd|rd|th)$", re.IGNORECASE)
TRAILING_DOT = "."


def tokens_of(text: str, ignored: frozenset[str]) -> list[str]:
    words = [ORDINAL.sub(r"\1", word.rstrip(TRAILING_DOT)) for word in TOKEN.findall(text)]
    return [word for word in words if word.lower() not in ignored]


def parse_with(candidate: str, formats: list[str]) -> datetime | None:
    for pattern in formats:
        try:
            return datetime.strptime(candidate, pattern)
        except ValueError:
            continue
    return None


class MomentFinder:
    def __init__(self, config: DatesConfig) -> None:
        self._config = config
        self._ignored = frozenset(word.lower() for word in config.ignored_words)

    def find(self, text: str, zone_name: str, after: datetime) -> datetime | None:
        try:
            zone = ZoneInfo(zone_name)
        except ZoneInfoNotFoundError:
            return None
        words = tokens_of(text, self._ignored)
        for index in range(len(words)):
            day = self._date_at(words, index)
            if day is None:
                continue
            clock = self._time_near(words, index)
            if clock is None:
                continue
            moment = datetime.combine(day, clock, tzinfo=zone)
            if moment > after:
                return moment
        return None

    def _date_at(self, words: list[str], index: int) -> date | None:
        for size in range(1, self._config.window_tokens + 1):
            parsed = parse_with(" ".join(words[index : index + size]), self._config.date_formats)
            if parsed is not None:
                return parsed.date()
        return None

    def _time_near(self, words: list[str], index: int) -> time | None:
        start = max(0, index - self._config.time_search_tokens)
        stop = index + self._config.time_search_tokens + self._config.window_tokens
        for position in range(start, min(len(words), stop)):
            for size in (2, 1):
                parsed = parse_with(" ".join(words[position : position + size]), self._config.time_formats)
                if parsed is not None:
                    return parsed.time()
        return None
