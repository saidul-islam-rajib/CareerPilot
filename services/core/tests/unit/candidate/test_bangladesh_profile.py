import pytest
from fastapi.testclient import TestClient

from careerpilot.api.user_app import create_user_app
from careerpilot.bootstrap import Container
from careerpilot.candidate.consistency import ConsistencyChecker
from careerpilot.candidate.models import Contact
from careerpilot.candidate.services.profile import BasicsChanges
from careerpilot.platform.enums import ConsistencyKind, ContactKind
from careerpilot.platform.errors import DomainError
from tests.unit.conftest import CLIENT, DEMO_USER

BASE_URL = "http://api.test/"


def identity(**changes: object) -> dict[str, object]:
    return {
        "name_english": "Ayesha Rahman",
        "date_of_birth": "1998-04-23",
        "father_name_english": "Abdur Rahman",
        "mother_name_english": "Salma Begum",
        "citizenship": "by_birth",
        "home_district": "coxs_bazar",
        **changes,
    }


def ssc(**changes: object) -> dict[str, object]:
    return {
        "exam": "ssc",
        "board_or_university": "Dhaka",
        "passing_year": 2014,
        "result_scale": "gpa_5",
        "result": "5.00",
        **changes,
    }


def kinds(container: Container) -> list[ConsistencyKind]:
    profile = container.profile.get(DEMO_USER)
    return [w.kind for w in container.profile.view(profile, BASE_URL).consistency]


def test_date_fields_accept_real_days_within_the_year_range(container: Container) -> None:
    profile = container.profile.add_entry(DEMO_USER, "identity", identity())
    assert profile.active_entries("identity")[0].values["date_of_birth"] == "1998-04-23"
    for bad in ("1998-02-30", "23/04/1998", "1800-01-01", "1998-4-3"):
        with pytest.raises(DomainError) as error:
            container.profile.update_entry(DEMO_USER, "identity", profile.active_entries("identity")[0].id, identity(date_of_birth=bad))
        assert error.value.detail == "identity.date_of_birth"


def test_select_values_come_from_enum_values_including_districts(container: Container) -> None:
    container.profile.add_entry(DEMO_USER, "addresses", {"kind": "present", "line": "House 12, Road 4", "district": "gazipur"})
    with pytest.raises(DomainError) as unknown_district:
        container.profile.add_entry(DEMO_USER, "addresses", {"kind": "present", "line": "House 12", "district": "atlantis"})
    assert unknown_district.value.detail == "addresses.district"
    with pytest.raises(DomainError) as unknown_exam:
        container.profile.add_entry(DEMO_USER, "academic_records", ssc(exam="gcse"))
    assert unknown_exam.value.detail == "academic_records.exam"


def test_identity_allows_one_entry_and_restore_respects_it(container: Container) -> None:
    first = container.profile.add_entry(DEMO_USER, "identity", identity()).active_entries("identity")[0]
    with pytest.raises(DomainError) as second:
        container.profile.add_entry(DEMO_USER, "identity", identity())
    assert second.value.detail == "identity"
    container.profile.remove_entry(DEMO_USER, "identity", first.id)
    container.profile.add_entry(DEMO_USER, "identity", identity(name_english="Ayesha R"))
    with pytest.raises(DomainError):
        container.profile.restore_entry(DEMO_USER, "identity", first.id)


def test_consistency_warns_for_names_dates_and_parents_that_differ(container: Container) -> None:
    container.profile.update_basics(DEMO_USER, BasicsChanges(full_name="Ayesha Rahman"))
    container.profile.add_entry(DEMO_USER, "identity", identity())
    container.profile.add_entry(
        DEMO_USER,
        "academic_records",
        ssc(
            name_on_certificate="AYESHA  RAHMAN.",
            date_of_birth_on_certificate="1998-04-24",
            father_name_on_certificate="Md. Abdur Rahman",
            mother_name_on_certificate="Salma Begum",
        ),
    )
    found = [k for k in kinds(container) if k is not ConsistencyKind.PHONE_FORMAT]
    assert found == [ConsistencyKind.DATE_OF_BIRTH, ConsistencyKind.FATHER_NAME]


def test_consistency_compares_the_profile_name_and_skips_empty_values(container: Container) -> None:
    container.profile.update_basics(DEMO_USER, BasicsChanges(full_name="Ayesha Siddiqua"))
    container.profile.add_entry(DEMO_USER, "identity", identity())
    container.profile.add_entry(DEMO_USER, "academic_records", ssc())
    profile = container.profile.get(DEMO_USER)
    view = container.profile.view(profile, BASE_URL)
    name = next(w for w in view.consistency if w.kind is ConsistencyKind.NAME)
    assert (name.section, name.field, name.expected, name.found) == ("profile", "full_name", "Ayesha Rahman", "Ayesha Siddiqua")
    assert view.home_country == "BD"


def test_phone_format_is_checked_only_for_the_home_country(container: Container) -> None:
    profile = container.profile.get(DEMO_USER)
    checker = ConsistencyChecker(container.profile._config.consistency)  # pyright: ignore[reportPrivateUsage]
    phones = [
        Contact(id="p1", kind=ContactKind.PHONE, value="+880 1712-345678", label="Mobile", is_primary=True, verified=True, position=1),
        Contact(id="p2", kind=ContactKind.PHONE, value="01712345678", label="Old", is_primary=False, verified=False, position=2),
    ]
    with_phones = profile.model_copy(update={"contacts": phones})
    assert [(w.entry_id, w.kind) for w in checker.check(with_phones, "BD")] == [("p2", ConsistencyKind.PHONE_FORMAT)]
    assert checker.check(with_phones, "SG") == []


def test_profile_api_returns_home_country_and_warnings(container: Container) -> None:
    client = TestClient(create_user_app(container))
    token = container.auth.sign_in("admin@sober.com", "admin@sober.com", CLIENT).access_token
    headers = {"Authorization": f"Bearer {token}"}
    added = client.post("/v1/profile/sections/identity", json={"values": identity(name_english="Someone Else")}, headers=headers)
    assert added.status_code == 200, added.text
    body = client.get("/v1/profile", headers=headers).json()
    assert body["homeCountry"] == "BD"
    name = next(w for w in body["consistency"] if w["kind"] == "name")
    assert (name["section"], name["field"], name["expected"]) == ("profile", "full_name", "Someone Else")
