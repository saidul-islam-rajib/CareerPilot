from datetime import date

import pytest

from careerpilot.bootstrap import Container
from careerpilot.candidate.age import age_on
from careerpilot.candidate.services.auth import Registration
from careerpilot.candidate.services.profile import BasicsChanges
from careerpilot.platform.errors import DomainError, ErrorCode
from tests.unit.conftest import CLIENT, DEMO_USER

NEW_EMAIL = "young.person@example.com"
ADULT_BORN = "1990-05-01"
YOUNG_BORN_YEARS = 10


def registration(born: str | None, guardian: bool = False) -> Registration:
    return Registration("Young Person", NEW_EMAIL, True, "1.0", "1.0", born, guardian)


def young_birth_date(container: Container) -> str:
    today = container.auth._ctx.clock.now().date()  # pyright: ignore[reportPrivateUsage]
    return today.replace(year=today.year - YOUNG_BORN_YEARS, day=1).isoformat()


def test_age_counts_whole_years() -> None:
    assert age_on(date(2010, 6, 15), date(2026, 6, 14)) == 15
    assert age_on(date(2010, 6, 15), date(2026, 6, 15)) == 16


def test_registration_below_the_minimum_age_needs_guardian_consent(container: Container) -> None:
    born = young_birth_date(container)
    with pytest.raises(DomainError) as raised:
        container.auth.register(registration(born), CLIENT)
    assert raised.value.code is ErrorCode.VALIDATION
    assert raised.value.detail == "guardian_consent"
    container.auth.register(registration(born, guardian=True), CLIENT)


def test_adults_and_unknown_birth_dates_register_normally(container: Container) -> None:
    container.auth.register(registration(ADULT_BORN), CLIENT)
    container.auth.register(registration(None), CLIENT)


def test_a_future_or_invalid_birth_date_is_rejected(container: Container) -> None:
    for value in ("2999-01-01", "not-a-date"):
        with pytest.raises(DomainError):
            container.auth.register(registration(value), CLIENT)


def test_profile_below_the_minimum_age_needs_guardian_consent(container: Container) -> None:
    born = young_birth_date(container)
    with pytest.raises(DomainError):
        container.profile.update_basics(DEMO_USER, BasicsChanges(date_of_birth=born))
    profile = container.profile.update_basics(DEMO_USER, BasicsChanges(date_of_birth=born, guardian_consent=True))
    assert profile.date_of_birth == born
    assert container.profile.update_basics(DEMO_USER, BasicsChanges(date_of_birth="")).date_of_birth is None
