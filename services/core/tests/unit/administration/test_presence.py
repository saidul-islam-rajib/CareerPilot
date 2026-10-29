from datetime import timedelta

from fastapi.testclient import TestClient

from careerpilot.api.admin_app import create_admin_app
from careerpilot.api.user_app import create_user_app
from careerpilot.bootstrap import Container
from careerpilot.platform.clock import FixedClock
from tests.unit.conftest import DEMO_USER

PASSWORD = "admin@sober.com"
DHAKA = {"X-Client-Time-Zone": "Asia/Dhaka"}


def signed_in(client: TestClient) -> dict[str, str]:
    session = client.post("/v1/auth/sign-in", json={"email": PASSWORD, "password": PASSWORD}, headers=DHAKA).json()
    return {"Authorization": f"Bearer {session['accessToken']}", **DHAKA}


def test_admins_see_who_is_online_where_and_for_how_long(container: Container, clock: FixedClock) -> None:
    client = TestClient(create_user_app(container))
    headers = signed_in(client)
    for _minute in range(3):
        clock.advance(timedelta(minutes=2))
        assert client.get("/v1/dashboard", headers=headers).status_code == 200
    [session] = container.presence.sessions_of(DEMO_USER)
    assert session.active_seconds == 6 * 60
    assert session.approximate_location == "Near Dhaka (Asia/Dhaka time zone)"
    presence = container.presence.presence_of(DEMO_USER)
    assert (presence.online, presence.sessions_count, presence.location) == (True, 1, session.approximate_location)
    admin = TestClient(create_admin_app(container))
    token = admin.post("/admin/v1/auth/sign-in", json={"email": PASSWORD, "password": PASSWORD}).json()["accessToken"]
    record = admin.get(f"/admin/v1/users/{DEMO_USER}/record", headers={"Authorization": f"Bearer {token}"}).json()
    assert record["user"]["presence"]["online"] is True
    assert record["sessions"][0]["activeSeconds"] == 6 * 60


def test_long_breaks_do_not_count_and_signing_out_ends_the_session(container: Container, clock: FixedClock) -> None:
    client = TestClient(create_user_app(container))
    headers = signed_in(client)
    clock.advance(timedelta(hours=3))
    client.get("/v1/dashboard", headers=headers)
    assert container.presence.sessions_of(DEMO_USER)[0].active_seconds == 0
    assert client.post("/v1/auth/sign-out", headers=headers).status_code == 204
    [session] = container.presence.sessions_of(DEMO_USER)
    assert session.signed_out_at is not None
    assert container.presence.presence_of(DEMO_USER).online is False


def test_requests_within_the_touch_interval_are_not_written_again(container: Container, clock: FixedClock) -> None:
    client = TestClient(create_user_app(container))
    headers = signed_in(client)
    clock.advance(timedelta(seconds=10))
    client.get("/v1/dashboard", headers=headers)
    assert container.presence.sessions_of(DEMO_USER)[0].active_seconds == 0
    clock.advance(timedelta(minutes=10))
    assert container.presence.presence_of(DEMO_USER).online is False
