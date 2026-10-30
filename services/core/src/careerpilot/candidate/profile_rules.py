import re
from collections.abc import Callable, Mapping
from datetime import date, datetime
from typing import cast
from urllib.parse import urlsplit

from careerpilot.candidate.models import PhotoCrop
from careerpilot.platform.config import EnumValueConfig, ProfileFieldConfig, ProfileLimits, ProfileSectionConfig, ValidationConfig
from careerpilot.platform.enums import ProfileFieldType
from careerpilot.platform.errors import DomainError, validation_error
from careerpilot.platform.validation import require_email

EntryValue = str | int | float | bool | None
MONTH = re.compile(r"^(\d{4})-(0[1-9]|1[0-2])$")
DAY = re.compile(r"^\d{4}-\d{2}-\d{2}$")
WHITESPACE = re.compile(r"\s+")
URL_SCHEMES = frozenset({"http", "https"})
OptionIndex = Mapping[str, frozenset[str]]


def option_index(values: list[EnumValueConfig]) -> dict[str, frozenset[str]]:
    grouped: dict[str, set[str]] = {}
    for row in values:
        if row.is_active:
            grouped.setdefault(row.enum_key, set()).add(row.value)
    return {key: frozenset(options) for key, options in grouped.items()}


def clean_text(value: str) -> str:
    return WHITESPACE.sub(" ", value).strip()


def clean_multiline(value: str) -> str:
    return "\n".join(line.rstrip() for line in value.strip().splitlines())


CROP_PRECISION = 6
CROP_TOLERANCE = 1e-6
CROP_DETAIL = "photo_crop"
WHOLE = 1.0


def require_photo_crop(crop: PhotoCrop) -> PhotoCrop:
    fits_x = crop.x >= -CROP_TOLERANCE and crop.width > 0 and crop.x + crop.width <= WHOLE + CROP_TOLERANCE
    fits_y = crop.y >= -CROP_TOLERANCE and crop.height > 0 and crop.y + crop.height <= WHOLE + CROP_TOLERANCE
    if not (fits_x and fits_y):
        raise validation_error(CROP_DETAIL)
    left, top = max(0.0, crop.x), max(0.0, crop.y)
    return PhotoCrop(
        x=round(left, CROP_PRECISION),
        y=round(top, CROP_PRECISION),
        width=round(min(crop.width, WHOLE - left), CROP_PRECISION),
        height=round(min(crop.height, WHOLE - top), CROP_PRECISION),
    )


def require_length(value: str, max_length: int | None, field: str) -> str:
    if max_length is not None and len(value) > max_length:
        raise validation_error(field)
    return value


class FieldRules:
    def __init__(self, limits: ProfileLimits, policy: ValidationConfig, now: datetime, options: OptionIndex) -> None:
        self._limits = limits
        self._policy = policy
        self._options = options
        self._phone = re.compile(limits.phone_pattern)
        self._max_year = now.year + limits.future_years
        self._parsers: dict[ProfileFieldType, Callable[[object, ProfileFieldConfig, str], EntryValue]] = {
            ProfileFieldType.TEXT: self._text,
            ProfileFieldType.TEXTAREA: self._textarea,
            ProfileFieldType.URL: self._url,
            ProfileFieldType.EMAIL: self._email,
            ProfileFieldType.PHONE: self._phone_number,
            ProfileFieldType.MONTH: self._month,
            ProfileFieldType.YEAR: self._year,
            ProfileFieldType.NUMBER: self._number,
            ProfileFieldType.SELECT: self._select,
            ProfileFieldType.BOOLEAN: self._boolean,
            ProfileFieldType.DATE: self._date,
        }

    def phone(self, value: str, field: str) -> str:
        cleaned = clean_text(value)
        if not self._phone.match(cleaned):
            raise validation_error(field)
        return cleaned

    def section_values(self, section: ProfileSectionConfig, raw: Mapping[str, object]) -> dict[str, EntryValue]:
        unknown = set(raw) - {f.key for f in section.fields}
        if unknown:
            raise validation_error(f"{section.key}.{sorted(unknown)[0]}")
        values = {f.key: self._parse(f, raw.get(f.key), f"{section.key}.{f.key}") for f in section.fields}
        self._check_period(section, values)
        return {k: v for k, v in values.items() if v is not None}

    def _parse(self, field: ProfileFieldConfig, value: object, name: str) -> EntryValue:
        empty = value is None or (isinstance(value, str) and not value.strip())
        if empty:
            if field.required:
                raise validation_error(name)
            return None
        return self._parsers[field.type](value, field, name)

    def _check_period(self, section: ProfileSectionConfig, values: dict[str, EntryValue]) -> None:
        if section.ongoing_field and values.get(section.ongoing_field) is True and section.end_field:
            values[section.end_field] = None
        start = values.get(section.start_field) if section.start_field else None
        end = values.get(section.end_field) if section.end_field else None
        if start is not None and end is not None and str(end) < str(start):
            raise validation_error(f"{section.key}.{section.end_field}")

    @staticmethod
    def _string(value: object, name: str) -> str:
        if not isinstance(value, str):
            raise validation_error(name)
        return value

    def _text(self, value: object, field: ProfileFieldConfig, name: str) -> EntryValue:
        return require_length(clean_text(self._string(value, name)), field.max_length, name)

    def _textarea(self, value: object, field: ProfileFieldConfig, name: str) -> EntryValue:
        return require_length(clean_multiline(self._string(value, name)), field.max_length, name)

    def _url(self, value: object, field: ProfileFieldConfig, name: str) -> EntryValue:
        text = require_length(self._string(value, name).strip(), field.max_length, name)
        parts = urlsplit(text)
        if parts.scheme.lower() not in URL_SCHEMES or not parts.netloc:
            raise validation_error(name)
        return text

    def _email(self, value: object, field: ProfileFieldConfig, name: str) -> EntryValue:
        try:
            return require_email(self._string(value, name), self._policy.email)
        except DomainError as error:
            raise validation_error(name) from error

    def _phone_number(self, value: object, field: ProfileFieldConfig, name: str) -> EntryValue:
        return require_length(self.phone(self._string(value, name), name), field.max_length, name)

    def _month(self, value: object, field: ProfileFieldConfig, name: str) -> EntryValue:
        text = self._string(value, name).strip()
        match = MONTH.match(text)
        if match is None or not self._limits.min_year <= int(match.group(1)) <= self._max_year:
            raise validation_error(name)
        return text

    def _year(self, value: object, field: ProfileFieldConfig, name: str) -> EntryValue:
        year = value if isinstance(value, int) and not isinstance(value, bool) else None
        if isinstance(value, str) and value.strip().isdigit():
            year = int(value.strip())
        if year is None or not self._limits.min_year <= year <= self._max_year:
            raise validation_error(name)
        return year

    def _number(self, value: object, field: ProfileFieldConfig, name: str) -> EntryValue:
        if isinstance(value, bool) or not isinstance(value, int | float):
            raise validation_error(name)
        number = float(value)
        if (field.min is not None and number < field.min) or (field.max is not None and number > field.max):
            raise validation_error(name)
        return number

    def _select(self, value: object, field: ProfileFieldConfig, name: str) -> EntryValue:
        text = self._string(value, name)
        if text not in self._options.get(field.options or "", frozenset[str]()):
            raise validation_error(name)
        return text

    def _date(self, value: object, field: ProfileFieldConfig, name: str) -> EntryValue:
        text = self._string(value, name).strip()
        try:
            parsed = date.fromisoformat(text) if DAY.match(text) else None
        except ValueError:
            parsed = None
        if parsed is None or not self._limits.min_year <= parsed.year <= self._max_year:
            raise validation_error(name)
        return text

    def _boolean(self, value: object, field: ProfileFieldConfig, name: str) -> EntryValue:
        if not isinstance(value, bool):
            raise validation_error(name)
        return value


def normalize_skills(skills: list[str], limits: ProfileLimits) -> list[str]:
    seen: set[str] = set()
    result: list[str] = []
    for raw in skills:
        skill = clean_text(raw)
        if not skill or skill.casefold() in seen:
            continue
        require_length(skill, limits.max_skill_length, "skills")
        seen.add(skill.casefold())
        result.append(skill)
    if len(result) > limits.max_skills:
        raise validation_error("skills")
    return result


def as_mapping(value: object) -> Mapping[str, object]:
    if not isinstance(value, dict):
        raise validation_error("values")
    return cast("Mapping[str, object]", value)
