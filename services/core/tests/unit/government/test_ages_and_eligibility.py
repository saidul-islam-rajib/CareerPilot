from datetime import date

from fastapi.testclient import TestClient

from careerpilot.bootstrap import Container
from careerpilot.government.ages import age_on, reached_minimum, within_maximum
from tests.unit.conftest import DEMO_USER
from tests.unit.government.conftest import fill_profile, honours, publish


def test_age_is_counted_in_years_months_and_days_as_of_the_cutoff() -> None:
    age = age_on(date(1998, 4, 23), date(2026, 10, 1))
    assert (age.years, age.months, age.days) == (28, 5, 8)
    assert age_on(date(2000, 2, 29), date(2026, 3, 1)).years == 26


def test_the_maximum_is_exact_to_the_day_and_leap_birthdays_turn_on_march_first() -> None:
    born = date(1996, 10, 1)
    assert within_maximum(born, date(2026, 10, 1), 30)
    assert not within_maximum(born, date(2026, 10, 2), 30)
    leap = date(2000, 2, 29)
    assert within_maximum(leap, date(2030, 3, 1), 30)
    assert reached_minimum(leap, date(2018, 3, 1), 18)
    assert not reached_minimum(leap, date(2018, 2, 28), 18)


def eligibility(user_client: TestClient, headers: dict[str, str], circular_id: object) -> dict[str, dict[str, object]]:
    view = user_client.get(f"/v1/government/circulars/{circular_id}", headers=headers).json()
    return {item["postId"]: item for item in view["posts"]}


def test_a_complete_profile_meets_age_and_education_as_of_the_circulars_cutoff(
    container: Container, user_client: TestClient, admin_client: TestClient, user_headers: dict[str, str], admin_headers: dict[str, str]
) -> None:
    fill_profile(container)
    created = publish(admin_client, admin_headers)
    first = eligibility(user_client, user_headers, created["id"])[created["posts"][0]["id"]]  # type: ignore[index]
    assert first["overall"] == "met"
    age = next(c for c in first["criteria"] if c["kind"] == "age")
    assert age["outcome"] == "met"
    assert age["found"] == "28y 5m 8d"


def test_missing_profile_facts_are_unknown_never_assumed(
    user_client: TestClient, admin_client: TestClient, user_headers: dict[str, str], admin_headers: dict[str, str]
) -> None:
    created = publish(admin_client, admin_headers)
    result = eligibility(user_client, user_headers, created["id"])
    for item in result.values():
        assert item["overall"] == "unknown"
    first = result[created["posts"][0]["id"]]  # type: ignore[index]
    reasons = {c["kind"]: c["reason"] for c in first["criteria"]}
    assert reasons["age"] == "profile_missing"
    assert reasons["education"] == "record_missing"


def test_a_circular_without_a_cutoff_leaves_age_unknown(
    container: Container, user_client: TestClient, admin_client: TestClient, user_headers: dict[str, str], admin_headers: dict[str, str]
) -> None:
    fill_profile(container)
    created = publish(admin_client, admin_headers, ageCutoffOn=None)
    first = eligibility(user_client, user_headers, created["id"])[created["posts"][0]["id"]]  # type: ignore[index]
    age = next(c for c in first["criteria"] if c["kind"] == "age")
    assert (age["outcome"], age["reason"]) == ("unknown", "cutoff_not_stated")


def test_age_relaxation_applies_only_with_a_verified_special_status(
    container: Container, user_client: TestClient, admin_client: TestClient, user_headers: dict[str, str], admin_headers: dict[str, str]
) -> None:
    fill_profile(container, date_of_birth="1995-01-15")
    created = publish(admin_client, admin_headers)
    post_id = created["posts"][0]["id"]  # type: ignore[index]

    def age() -> dict[str, object]:
        first = eligibility(user_client, user_headers, created["id"])[post_id]
        return next(c for c in first["criteria"] if c["kind"] == "age")

    assert age()["outcome"] == "not_met"
    assert age()["reason"] == "above_maximum"
    container.profile.add_entry(DEMO_USER, "special_status", {"status": "freedom_fighter_child"})
    assert (age()["outcome"], age()["reason"]) == ("unknown", "relaxation_unverified")
    entry = container.profile.get(DEMO_USER).active_entries("special_status")[0]
    container.profile.update_entry(
        DEMO_USER, "special_status", entry.id, {"status": "freedom_fighter_child", "document_name": "Certificate 12"}
    )
    assert (age()["outcome"], age()["reason"]) == ("met", "relaxation_applied")


def test_education_compares_numeric_results_subject_and_scale(
    container: Container, user_client: TestClient, admin_client: TestClient, user_headers: dict[str, str], admin_headers: dict[str, str]
) -> None:
    container.profile.add_entry(DEMO_USER, "identity", {"name_english": "A", "date_of_birth": "1998-04-23", "citizenship": "by_birth"})
    container.profile.add_entry(DEMO_USER, "academic_records", honours(result="2.10", group_subject="Physics"))
    required = {"exam": "bachelor_honours", "scale": "cgpa_4", "minResult": "2.50", "subjectKeywords": ["physics"]}
    created = publish(admin_client, admin_headers, posts=[{"title": "Lecturer", "grade": 9, "education": [required]}])
    education = eligibility(user_client, user_headers, created["id"])[created["posts"][0]["id"]]["criteria"]  # type: ignore[index]
    assert [(c["kind"], c["outcome"], c["reason"]) for c in education if c["kind"] == "education"] == [
        ("education", "not_met", "result_below")
    ]
    other = {**required, "subjectKeywords": ["chemistry"]}
    second = publish(admin_client, admin_headers, posts=[{"title": "Chemist", "grade": 9, "education": [other]}])
    criteria = eligibility(user_client, user_headers, second["id"])[second["posts"][0]["id"]]["criteria"]  # type: ignore[index]
    assert [c["reason"] for c in criteria if c["kind"] == "education"] == ["subject_mismatch"]
    wrong_scale = {**required, "scale": "gpa_5"}
    third = publish(admin_client, admin_headers, posts=[{"title": "Clerk", "grade": 9, "education": [wrong_scale]}])
    scale = eligibility(user_client, user_headers, third["id"])[third["posts"][0]["id"]]["criteria"]  # type: ignore[index]
    assert [c["reason"] for c in scale if c["kind"] == "education"] == ["scale_differs"]


def test_district_and_quota_claims_follow_the_profile(
    container: Container, user_client: TestClient, admin_client: TestClient, user_headers: dict[str, str], admin_headers: dict[str, str]
) -> None:
    fill_profile(container)
    districts = ["coxs_bazar", "feni"]
    posts = [
        {
            "title": "Field Officer",
            "grade": 10,
            "districts": districts,
            "quotas": [{"kind": "general"}, {"kind": "district"}, {"kind": "women"}, {"kind": "freedom_fighter"}],
        },
        {"title": "Outside", "grade": 10, "districts": ["dhaka"]},
    ]
    created = publish(admin_client, admin_headers, posts=posts)
    result = eligibility(user_client, user_headers, created["id"])
    inside = result[created["posts"][0]["id"]]  # type: ignore[index]
    assert {c["kind"]: c["outcome"] for c in inside["criteria"]}["district"] == "met"
    assert {q["kind"]: q["outcome"] for q in inside["quotas"]} == {
        "general": "met",
        "district": "met",
        "women": "unknown",
        "freedom_fighter": "unknown",
    }
    outside = result[created["posts"][1]["id"]]  # type: ignore[index]
    assert outside["overall"] == "not_met"
    listing = user_client.get("/v1/government/circulars?eligibleOnly=true", headers=user_headers).json()
    assert [p["title"] for p in listing[0]["posts"]] == ["Field Officer"]


def test_not_a_citizen_fails_the_citizenship_check(
    container: Container, user_client: TestClient, admin_client: TestClient, user_headers: dict[str, str], admin_headers: dict[str, str]
) -> None:
    fill_profile(container, citizenship="other")
    created = publish(admin_client, admin_headers)
    first = eligibility(user_client, user_headers, created["id"])[created["posts"][0]["id"]]  # type: ignore[index]
    assert first["overall"] == "not_met"
    assert {c["kind"]: c["reason"] for c in first["criteria"]}["citizenship"] == "not_a_citizen"
