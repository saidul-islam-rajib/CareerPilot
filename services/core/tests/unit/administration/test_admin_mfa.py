from datetime import timedelta

import pytest
from fastapi.testclient import TestClient

from careerpilot.administration.adapters.sql import SqlAdminAccountRepository
from careerpilot.administration.context import AdminActor
from careerpilot.administration.mfa import (
    code_at,
    looks_like_totp,
    matching_step,
    new_recovery_code,
    new_secret,
    normalized_recovery_code,
    otpauth_uri,
    time_step,
)
from careerpilot.administration.models import AdminAccount
from careerpilot.administration.ports import AdminCredential
from careerpilot.api.admin_app import create_admin_app
from careerpilot.bootstrap import Container
from careerpilot.platform.clock import FixedClock
from careerpilot.platform.enums import AdminRole
from careerpilot.platform.errors import ErrorCode
from careerpilot.platform.persistence import SQLITE_MEMORY_URL, Base, create_database
from tests.unit.administration.conftest import PASSWORD, actor, failure
from tests.unit.conftest import CLIENT, FakeHasher

EMAIL = "admin@sober.com"
RFC_SECRET = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ"
RFC_TIMES = {59: "287082", 1111111109: "081804", 1234567890: "005924"}
NEXT_STEP = timedelta(seconds=30)


def current_code(app: Container, secret: str, clock: FixedClock) -> str:
    config = app.settings.security.mfa
    return code_at(config, secret, time_step(config, int(clock.now().timestamp())))


def enrol(app: Container, clock: FixedClock, admin: AdminActor) -> tuple[str, list[str]]:
    secret = app.admin_mfa.begin(admin).secret
    codes = app.admin_mfa.confirm(admin, current_code(app, secret, clock), CLIENT.ip).codes
    clock.advance(NEXT_STEP)
    return secret, codes


def test_totp_matches_rfc_6238_vectors(app: Container) -> None:
    config = app.settings.security.mfa.model_copy(update={"digits": 6})
    for seconds, expected in RFC_TIMES.items():
        assert code_at(config, RFC_SECRET, time_step(config, seconds)) == expected[-6:]


def test_totp_window_and_replay_guard(app: Container) -> None:
    config = app.settings.security.mfa
    secret = new_secret(config)
    now = 1_000_000
    step = time_step(config, now)
    assert matching_step(config, secret, code_at(config, secret, step), now, None) == step
    assert matching_step(config, secret, code_at(config, secret, step - 1), now, None) == step - 1
    assert matching_step(config, secret, code_at(config, secret, step + 2), now, None) is None
    assert matching_step(config, secret, code_at(config, secret, step), now, step) is None


def test_helpers_shape_codes_and_uri(app: Container) -> None:
    config = app.settings.security.mfa
    assert looks_like_totp(config, "123456")
    assert not looks_like_totp(config, "12345a")
    assert not looks_like_totp(config, "1234567")
    assert normalized_recovery_code(" AB-cd ") == "ab-cd"
    assert new_recovery_code(config) != new_recovery_code(config)
    uri = otpauth_uri(config, "Career Pilot", "a@b.test", "SECRET")
    assert uri.startswith("otpauth://totp/Career%20Pilot:a%40b.test?secret=SECRET")
    assert f"digits={config.digits}" in uri


def test_enrolment_requires_a_valid_code_and_returns_recovery_codes(app: Container, clock: FixedClock) -> None:
    admin = actor(app)
    enrolment = app.admin_mfa.begin(admin)
    assert enrolment.otpauth_uri.startswith("otpauth://totp/")
    assert failure(lambda: app.admin_mfa.confirm(admin, "000000", CLIENT.ip))[0] is ErrorCode.INVALID_CREDENTIALS
    assert app.admin_auth.sign_in(EMAIL, PASSWORD, CLIENT.ip).mfa_enabled is False
    codes = app.admin_mfa.confirm(admin, current_code(app, enrolment.secret, clock), CLIENT.ip)
    assert len(codes.codes) == app.settings.security.mfa.recovery_code_count
    credential = app.admin_auth._ctx.admins.get(admin.summary.id)  # pyright: ignore[reportPrivateUsage]
    assert credential is not None
    assert credential.account.mfa_enabled
    assert credential.mfa_secret not in (None, enrolment.secret)
    assert all(code not in credential.mfa_recovery_hashes for code in codes.codes)
    assert credential.mfa_pending_secret is None


def test_enrolment_edge_cases(app: Container, clock: FixedClock) -> None:
    admin = actor(app)
    assert failure(lambda: app.admin_mfa.confirm(admin, "123456", CLIENT.ip))[0] is ErrorCode.VALIDATION
    enrol(app, clock, admin)
    assert failure(lambda: app.admin_mfa.begin(admin))[0] is ErrorCode.CONFLICT


def test_sign_in_needs_a_code_once_enrolled_and_blocks_replay(app: Container, clock: FixedClock) -> None:
    secret, _ = enrol(app, clock, actor(app))
    assert failure(lambda: app.admin_auth.sign_in(EMAIL, PASSWORD, CLIENT.ip))[0] is ErrorCode.MFA_REQUIRED
    assert failure(lambda: app.admin_auth.sign_in(EMAIL, PASSWORD, CLIENT.ip, "000000"))[0] is ErrorCode.INVALID_CREDENTIALS
    code = current_code(app, secret, clock)
    session = app.admin_auth.sign_in(EMAIL, PASSWORD, CLIENT.ip, code)
    assert session.mfa_enabled
    assert failure(lambda: app.admin_auth.sign_in(EMAIL, PASSWORD, CLIENT.ip, code))[0] is ErrorCode.INVALID_CREDENTIALS
    assert failure(lambda: app.admin_auth.sign_in(EMAIL, "wrong", CLIENT.ip, code))[0] is ErrorCode.INVALID_CREDENTIALS


def test_recovery_codes_work_once_and_can_be_regenerated(app: Container, clock: FixedClock) -> None:
    admin = actor(app)
    secret, codes = enrol(app, clock, admin)
    app.admin_auth.sign_in(EMAIL, PASSWORD, CLIENT.ip, codes[0].upper())
    assert failure(lambda: app.admin_auth.sign_in(EMAIL, PASSWORD, CLIENT.ip, codes[0]))[0] is ErrorCode.INVALID_CREDENTIALS
    clock.advance(NEXT_STEP)
    fresh = app.admin_mfa.regenerate(admin, current_code(app, secret, clock), CLIENT.ip)
    assert set(fresh.codes).isdisjoint(codes)
    assert failure(lambda: app.admin_auth.sign_in(EMAIL, PASSWORD, CLIENT.ip, codes[1]))[0] is ErrorCode.INVALID_CREDENTIALS
    app.admin_auth.sign_in(EMAIL, PASSWORD, CLIENT.ip, fresh.codes[0])


def test_regeneration_needs_enrolment_and_a_valid_code(app: Container, clock: FixedClock) -> None:
    admin = actor(app)
    assert failure(lambda: app.admin_mfa.regenerate(admin, "123456", CLIENT.ip))[0] is ErrorCode.MFA_REQUIRED
    enrol(app, clock, admin)
    assert failure(lambda: app.admin_mfa.regenerate(admin, "000000", CLIENT.ip))[0] is ErrorCode.INVALID_CREDENTIALS


def test_repeated_wrong_codes_lock_the_account(app: Container, clock: FixedClock) -> None:
    enrol(app, clock, actor(app))
    codes = [failure(lambda: app.admin_auth.sign_in(EMAIL, PASSWORD, CLIENT.ip, "000000"))[0] for _ in range(20)]
    assert ErrorCode.TOO_MANY_ATTEMPTS in codes


def test_reauthentication_proof_is_short_lived_and_personal(app: Container, clock: FixedClock) -> None:
    admin = actor(app)
    assert failure(lambda: app.admin_auth.require_reauth(admin, None))[0] is ErrorCode.REAUTH_REQUIRED
    assert failure(lambda: app.admin_auth.reauthenticate(admin, PASSWORD, "123456", CLIENT.ip))[0] is ErrorCode.MFA_REQUIRED
    secret, _ = enrol(app, clock, admin)
    code = current_code(app, secret, clock)
    assert failure(lambda: app.admin_auth.reauthenticate(admin, "wrong", code, CLIENT.ip))[0] is ErrorCode.INVALID_CREDENTIALS
    assert failure(lambda: app.admin_auth.reauthenticate(admin, PASSWORD, "000000", CLIENT.ip))[0] is ErrorCode.INVALID_CREDENTIALS
    proof = app.admin_auth.reauthenticate(admin, PASSWORD, code, CLIENT.ip)
    app.admin_auth.require_reauth(admin, proof.reauth_token)
    other = actor(app, "viewer@sober.com")
    assert failure(lambda: app.admin_auth.require_reauth(other, proof.reauth_token))[0] is ErrorCode.REAUTH_REQUIRED
    assert failure(lambda: app.admin_auth.require_reauth(admin, "garbage"))[0] is ErrorCode.REAUTH_REQUIRED
    clock.advance(timedelta(minutes=app.settings.security.mfa.reauth_ttl_minutes, seconds=1))
    assert failure(lambda: app.admin_auth.require_reauth(admin, proof.reauth_token))[0] is ErrorCode.REAUTH_REQUIRED


def test_a_session_token_is_not_a_reauthentication_proof(app: Container) -> None:
    token = app.admin_auth.sign_in(EMAIL, PASSWORD, CLIENT.ip).access_token
    admin = app.admin_auth.authenticate(token)
    assert failure(lambda: app.admin_auth.require_reauth(admin, token))[0] is ErrorCode.REAUTH_REQUIRED


def test_destructive_actions_over_http_need_the_proof(app: Container, clock: FixedClock) -> None:
    client = TestClient(create_admin_app(app))
    admin = actor(app)
    secret, _ = enrol(app, clock, admin)
    session = client.post("/admin/v1/auth/sign-in", json={"email": EMAIL, "password": PASSWORD, "code": current_code(app, secret, clock)})
    headers = {"Authorization": f"Bearer {session.json()['accessToken']}"}
    stop = {"scope": "all_users", "reason": "test"}
    refused = client.post("/admin/v1/emergency-stop", json=stop, headers=headers)
    assert (refused.status_code, refused.json()["code"]) == (403, "reauth_required")
    assert client.post("/admin/v1/users/usr_002/suspend", json={"reason": "x"}, headers=headers).json()["code"] == "reauth_required"
    assert client.delete("/admin/v1/admins/adm_x", headers=headers).json()["code"] == "reauth_required"
    assert client.post("/admin/v1/roles", json={"name": "n", "permissions": []}, headers=headers).json()["code"] == "reauth_required"
    clock.advance(NEXT_STEP)
    body = {"password": PASSWORD, "code": current_code(app, secret, clock)}
    proof = client.post("/admin/v1/auth/reauthenticate", json=body, headers=headers).json()["reauthToken"]
    allowed = client.post("/admin/v1/emergency-stop", json=stop, headers={**headers, "X-Reauth-Token": proof})
    assert allowed.status_code == 200


def test_enrolment_endpoints(app: Container, clock: FixedClock) -> None:
    client = TestClient(create_admin_app(app))
    token = client.post("/admin/v1/auth/sign-in", json={"email": EMAIL, "password": PASSWORD}).json()["accessToken"]
    headers = {"Authorization": f"Bearer {token}"}
    enrolment = client.post("/admin/v1/auth/mfa/enrol", headers=headers).json()
    confirmed = client.post("/admin/v1/auth/mfa/confirm", json={"code": current_code(app, enrolment["secret"], clock)}, headers=headers)
    assert len(confirmed.json()["codes"]) == app.settings.security.mfa.recovery_code_count
    clock.advance(NEXT_STEP)
    code = current_code(app, enrolment["secret"], clock)
    assert client.post("/admin/v1/auth/mfa/recovery-codes", json={"code": code}, headers=headers).status_code == 200


def test_sql_repository_keeps_second_factor_data(clock: FixedClock) -> None:
    database = create_database(SQLITE_MEMORY_URL, clock)
    Base.metadata.create_all(database.engine)
    repository = SqlAdminAccountRepository(database, clock)
    account = AdminAccount(id="adm_t", full_name="T", email="t@example.test", role=AdminRole.SUPER_ADMIN, suspended=False, mfa_enabled=True)
    credential = AdminCredential(account, FakeHasher().hash("p"), "sealed", "pending", 7, ["h1", "h2"])
    repository.save(credential)
    loaded = repository.get("adm_t")
    assert loaded is not None
    assert (loaded.mfa_secret, loaded.mfa_pending_secret, loaded.mfa_last_step, loaded.mfa_recovery_hashes) == (
        "sealed",
        "pending",
        7,
        ["h1", "h2"],
    )
    loaded.mfa_recovery_hashes = []
    repository.save(loaded)
    again = repository.find_by_email("t@example.test")
    assert again is not None
    assert again.mfa_recovery_hashes == []
    plain = AdminCredential(account.model_copy(update={"id": "adm_u", "email": "u@example.test"}), "h")
    repository.save(plain)
    stored = repository.get("adm_u")
    assert stored is not None
    assert stored.mfa_secret is None
    assert stored.mfa_last_step is None


@pytest.mark.parametrize("email", ["viewer@sober.com"])
def test_other_admins_keep_signing_in_without_a_code(app: Container, email: str) -> None:
    assert app.admin_auth.sign_in(email, PASSWORD, CLIENT.ip).mfa_enabled is False
