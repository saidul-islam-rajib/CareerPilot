from datetime import date

import pytest
from fastapi.testclient import TestClient

from careerpilot.api.admin_app import create_admin_app
from careerpilot.api.user_app import create_user_app
from careerpilot.bootstrap import Container
from tests.unit.conftest import DEMO_USER

PASSWORD = "admin@sober.com"
CLOSES = date(2026, 11, 12)
CUTOFF = date(2026, 10, 1)


@pytest.fixture
def user_client(container: Container) -> TestClient:
    return TestClient(create_user_app(container))


@pytest.fixture
def admin_client(container: Container) -> TestClient:
    return TestClient(create_admin_app(container))


@pytest.fixture
def user_headers(user_client: TestClient) -> dict[str, str]:
    token = user_client.post("/v1/auth/sign-in", json={"email": "admin@sober.com", "password": PASSWORD}).json()["accessToken"]
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def admin_headers(admin_client: TestClient) -> dict[str, str]:
    token = admin_client.post("/admin/v1/auth/sign-in", json={"email": "admin@sober.com", "password": PASSWORD}).json()["accessToken"]
    return {"Authorization": f"Bearer {token}"}


def post(title: str = "Assistant Officer", **changes: object) -> dict[str, object]:
    return {
        "title": title,
        "grade": 9,
        "vacancies": 10,
        "location": "Dhaka",
        "age": {"maxYears": 30, "relaxations": [{"status": "freedom_fighter_child", "maxYears": 32}]},
        "education": [{"exam": "bachelor_honours", "scale": "cgpa_4", "minResult": "2.50"}],
        "quotas": [{"kind": "general", "vacancies": 6}, {"kind": "freedom_fighter", "vacancies": 4}],
        **changes,
    }


def circular(**changes: object) -> dict[str, object]:
    return {
        "authority": "Ministry of Public Administration",
        "title": "Recruitment of Assistant Officers",
        "sourceName": "alljobs.teletalk.com.bd",
        "noticeUrl": "https://alljobs.teletalk.com.bd/notice/1",
        "applyUrl": "https://alljobs.teletalk.com.bd/apply/1",
        "publishedOn": "2026-10-10",
        "opensOn": "2026-10-12",
        "closesOn": CLOSES.isoformat(),
        "closesTime": "17:00",
        "ageCutoffOn": CUTOFF.isoformat(),
        "fee": {"amount": 112, "method": "mobile_banking", "windowHours": 120},
        "posts": [post(), post("Office Assistant", grade=16, age={"maxYears": 30}, education=[{"exam": "hsc"}])],
        **changes,
    }


def identity(**changes: object) -> dict[str, object]:
    return {
        "name_english": "Ayesha Rahman",
        "date_of_birth": "1998-04-23",
        "citizenship": "by_birth",
        "home_district": "coxs_bazar",
        **changes,
    }


def honours(**changes: object) -> dict[str, object]:
    return {
        "exam": "bachelor_honours",
        "board_or_university": "University of Dhaka",
        "passing_year": 2020,
        "result_scale": "cgpa_4",
        "result": "3.40",
        **changes,
    }


def fill_profile(container: Container, **identity_changes: object) -> None:
    container.profile.add_entry(DEMO_USER, "identity", identity(**identity_changes))
    container.profile.add_entry(DEMO_USER, "academic_records", honours())


def publish(admin_client: TestClient, headers: dict[str, str], **changes: object) -> dict[str, object]:
    created = admin_client.post("/admin/v1/government/circulars", json=circular(**changes), headers=headers)
    assert created.status_code == 200
    body: dict[str, object] = created.json()
    published = admin_client.post(f"/admin/v1/government/circulars/{body['id']}/publish", headers=headers)
    assert published.status_code == 200
    result: dict[str, object] = published.json()
    return result
