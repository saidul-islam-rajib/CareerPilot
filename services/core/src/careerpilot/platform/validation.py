import re

from careerpilot.platform.config import LengthPolicy, PasswordPolicy, TrackPolicy
from careerpilot.platform.errors import validation_error

EMAIL_PATTERN = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
EMAIL_IN_TEXT = re.compile(r"[\w.+-]+@[\w-]+(?:\.[\w-]+)+")
TIME_PATTERN = re.compile(r"^([01]\d|2[0-3]):[0-5]\d$")
LOWER = re.compile(r"[a-z]")
UPPER = re.compile(r"[A-Z]")
DIGIT = re.compile(r"\d")
SYMBOL = re.compile(r"[^A-Za-z0-9]")


def require_email(value: str, policy: LengthPolicy) -> str:
    email = value.strip().lower()
    if not email or len(email) > policy.max_length or not EMAIL_PATTERN.match(email):
        raise validation_error("email")
    return email


def require_name(value: str, policy: LengthPolicy) -> str:
    name = value.strip()
    if not policy.min_length <= len(name) <= policy.max_length:
        raise validation_error("name")
    return name


def require_password(value: str, policy: PasswordPolicy) -> str:
    checks = [
        policy.min_length <= len(value) <= policy.max_length,
        not policy.require_mixed_case or bool(LOWER.search(value) and UPPER.search(value)),
        not policy.require_digit or bool(DIGIT.search(value)),
        not policy.require_symbol or bool(SYMBOL.search(value)),
    ]
    if not all(checks):
        raise validation_error("password")
    return value


def require_text(value: str, policy: LengthPolicy) -> str:
    text = value.strip()
    if not text or len(text) > policy.max_length:
        raise validation_error("text")
    return text


def require_time(value: str | None) -> str:
    if value is None or not TIME_PATTERN.match(value):
        raise validation_error("time")
    return value


def require_result_count(value: int, policy: TrackPolicy) -> int:
    if not policy.min_result_count <= value <= policy.max_result_count:
        raise validation_error("result_count")
    return value
