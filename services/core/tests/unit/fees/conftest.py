from datetime import timedelta
from typing import Any

import pytest
from fastapi.testclient import TestClient

from careerpilot.api.user_app import create_user_app
from careerpilot.bootstrap import Container
from careerpilot.platform.clock import FixedClock

PASSWORD = "admin@sober.com"
BASE = "/v1/fees"


@pytest.fixture
def client(container: Container) -> TestClient:
    app = TestClient(create_user_app(container))
    token = app.post("/v1/auth/sign-in", json={"email": "admin@sober.com", "password": PASSWORD}).json()["accessToken"]
    app.headers["Authorization"] = f"Bearer {token}"
    return app


def deadline_in(clock: FixedClock, **delta: float) -> str:
    return (clock.now() + timedelta(**delta)).isoformat()


def rule_body(**changes: object) -> dict[str, Any]:
    return {"kind": "job", "title": "Application fee", "amount": 500, "currency": "BDT", "payee": "Acme Ltd", **changes}


def payment_body(**changes: object) -> dict[str, Any]:
    return {"title": "Exam fee", "amount": 700, "currency": "BDT", "payee": "Board", **changes}


def make_payment(client: TestClient, **changes: object) -> dict[str, Any]:
    response = client.post(f"{BASE}/payments", json=payment_body(**changes))
    assert response.status_code == 200, response.text
    body: dict[str, Any] = response.json()
    return body


def act(client: TestClient, payment_id: str, **body: object) -> Any:
    return client.post(f"{BASE}/payments/{payment_id}/actions", json=body)
