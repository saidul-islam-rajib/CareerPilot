from typing import Any

import pytest
from fastapi.testclient import TestClient

from careerpilot.api.user_app import create_user_app
from careerpilot.bootstrap import Container

PASSWORD = "admin@sober.com"
BASE = "/v1/academic"


@pytest.fixture
def client(container: Container) -> TestClient:
    app = TestClient(create_user_app(container))
    token = app.post("/v1/auth/sign-in", json={"email": "admin@sober.com", "password": PASSWORD}).json()["accessToken"]
    app.headers["Authorization"] = f"Bearer {token}"
    return app


def program_body(**changes: object) -> dict[str, Any]:
    return {"kind": "taught_masters", "title": "MSc Data Science", "university": "Northern University", **changes}


def make_program(client: TestClient, **changes: object) -> dict[str, Any]:
    response = client.post(f"{BASE}/programs", json=program_body(**changes))
    assert response.status_code == 200, response.text
    body: dict[str, Any] = response.json()
    return body


def make_referee(client: TestClient, consent: bool = True) -> dict[str, Any]:
    created = client.post(f"{BASE}/referees", json={"name": "Dr Rahim", "email": "rahim@example.org"}).json()
    if consent:
        created = client.put(f"{BASE}/referees/{created['id']}/consent", json={"confirmed": True}).json()
    return created
