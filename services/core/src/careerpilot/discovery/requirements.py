import re
from dataclasses import dataclass, field
from datetime import datetime
from typing import Protocol
from zoneinfo import ZoneInfo

from careerpilot.discovery.bangla import latin_digits
from careerpilot.platform.clock import iso
from careerpilot.platform.config import BangladeshConfig, DiscoveryConfig


@dataclass(frozen=True)
class ExtractedRequirements:
    age_max: int | None = None
    experience_years: int | None = None
    fee_amount: int | None = None
    posts: int | None = None
    deadline: str | None = None
    education: list[str] = field(default_factory=list[str])


class RequirementExtractor(Protocol):
    def extract(self, text: str) -> ExtractedRequirements: ...


def _first_group(patterns: list[str], text: str) -> str | None:
    for pattern in patterns:
        found = re.search(pattern, text, re.IGNORECASE)
        if found:
            return found.group(1)
    return None


def _number(patterns: list[str], text: str) -> int | None:
    raw = _first_group(patterns, text)
    digits = raw.replace(",", "") if raw else ""
    return int(digits) if digits.isdigit() else None


class RuleRequirementExtractor:
    def __init__(self, discovery: DiscoveryConfig) -> None:
        self._config: BangladeshConfig = discovery.bangladesh
        self._date_formats = discovery.date_formats
        self._zone = ZoneInfo(discovery.bangladesh.time_zone)

    def extract(self, text: str) -> ExtractedRequirements:
        clean = latin_digits(text, self._config)
        rules = self._config.requirements
        return ExtractedRequirements(
            age_max=_number(rules.age_max, clean),
            experience_years=_number(rules.experience_years, clean),
            fee_amount=_number(rules.fee_amount, clean),
            posts=_number(rules.posts, clean),
            deadline=self._deadline(_first_group(rules.deadline, clean)),
            education=self._education(rules.education, clean),
        )

    def _education(self, patterns: list[str], text: str) -> list[str]:
        found: list[str] = []
        for pattern in patterns:
            for match in re.finditer(pattern, text, re.IGNORECASE):
                level = match.group(0).casefold()
                if level not in found:
                    found.append(level)
        return found

    def _deadline(self, raw: str | None) -> str | None:
        if not raw:
            return None
        cleaned = raw.replace(".", "/").replace(",", "")
        for pattern in (*self._date_formats, "%d %b %Y"):
            try:
                return iso(datetime.strptime(cleaned, pattern.replace(",", "")).replace(tzinfo=self._zone))
            except ValueError:
                continue
        return None
