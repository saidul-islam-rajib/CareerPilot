from datetime import date

from careerpilot.platform.errors import validation_error

DATE_OF_BIRTH_DETAIL = "date_of_birth"
GUARDIAN_CONSENT_DETAIL = "guardian_consent"


def parse_date_of_birth(value: str, today: date) -> date:
    try:
        born = date.fromisoformat(value.strip())
    except ValueError as error:
        raise validation_error(DATE_OF_BIRTH_DETAIL) from error
    if born > today:
        raise validation_error(DATE_OF_BIRTH_DETAIL)
    return born


def age_on(born: date, today: date) -> int:
    had_birthday = (today.month, today.day) >= (born.month, born.day)
    return today.year - born.year - (0 if had_birthday else 1)


def require_guardian_when_young(born: date | None, guardian_consent: bool, minimum_age: int, today: date) -> None:
    if born is not None and age_on(born, today) < minimum_age and not guardian_consent:
        raise validation_error(GUARDIAN_CONSENT_DETAIL)
