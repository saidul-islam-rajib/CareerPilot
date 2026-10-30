import re

from careerpilot.candidate.models import EntryValue, Profile
from careerpilot.platform.config import ConsistencyConfig, ConsistencyRule
from careerpilot.platform.enums import ConsistencyKind, ContactKind
from careerpilot.platform.model import CamelModel

PROFILE_SECTION = "profile"
CONTACTS_SECTION = "contacts"
CONTACT_FIELD = "value"
FIELD_SEPARATOR = "."
WHITESPACE = re.compile(r"\s+")
PHONE_PUNCTUATION = re.compile(r"[\s()-]")


class ConsistencyWarning(CamelModel):
    kind: ConsistencyKind
    section: str
    entry_id: str
    field: str
    expected: str
    found: str


def _present(value: EntryValue | None) -> bool:
    return value is not None and str(value).strip() != ""


class ConsistencyChecker:
    def __init__(self, config: ConsistencyConfig) -> None:
        self._config = config
        self._ignored = re.compile(f"[{re.escape(config.ignored_characters)}]") if config.ignored_characters else None
        self._mobile = {p.country: re.compile(p.pattern) for p in config.mobile_patterns}

    def check(self, profile: Profile, home_country: str) -> list[ConsistencyWarning]:
        found = [warning for rule in self._config.rules for warning in self._compare(profile, rule)]
        return found + self._phones(profile, home_country)

    def _normalized(self, value: str) -> str:
        text = self._ignored.sub(" ", value) if self._ignored else value
        return WHITESPACE.sub(" ", text).strip().casefold()

    def _differs(self, expected: str, found: str) -> bool:
        return self._normalized(expected) != self._normalized(found)

    def _compare(self, profile: Profile, rule: ConsistencyRule) -> list[ConsistencyWarning]:
        section, field = rule.source.split(FIELD_SEPARATOR, 1)
        expected = next((str(e.values[field]) for e in profile.active_entries(section) if _present(e.values.get(field))), None)
        if expected is None:
            return []
        return [warning for target in rule.targets for warning in self._targets(profile, rule.kind, expected, target)]

    def _targets(self, profile: Profile, kind: ConsistencyKind, expected: str, target: str) -> list[ConsistencyWarning]:
        section, field = target.split(FIELD_SEPARATOR, 1)
        if section == PROFILE_SECTION:
            value = getattr(profile, field, "")
            if not _present(value) or not self._differs(expected, str(value)):
                return []
            return [ConsistencyWarning(kind=kind, section=section, entry_id="", field=field, expected=expected, found=str(value))]
        return [
            ConsistencyWarning(
                kind=kind, section=section, entry_id=entry.id, field=field, expected=expected, found=str(entry.values[field])
            )
            for entry in profile.active_entries(section)
            if _present(entry.values.get(field)) and self._differs(expected, str(entry.values[field]))
        ]

    def _phones(self, profile: Profile, home_country: str) -> list[ConsistencyWarning]:
        pattern = self._mobile.get(home_country)
        if pattern is None:
            return []
        return [
            ConsistencyWarning(
                kind=ConsistencyKind.PHONE_FORMAT, section=CONTACTS_SECTION, entry_id=c.id, field=CONTACT_FIELD, expected="", found=c.value
            )
            for c in profile.active_contacts()
            if c.kind is ContactKind.PHONE and not pattern.match(PHONE_PUNCTUATION.sub("", c.value))
        ]
