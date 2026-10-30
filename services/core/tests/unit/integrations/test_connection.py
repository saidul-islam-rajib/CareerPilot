from datetime import timedelta
from urllib.parse import parse_qs, urlsplit

import pytest
from fastapi.testclient import TestClient

from careerpilot.api.admin_app import create_admin_app
from careerpilot.api.user_app import create_user_app
from careerpilot.bootstrap import Container
from careerpilot.integrations.fake_google import FakeGoogleGateway
from careerpilot.integrations.vault import FernetCipher, vault_secret
from careerpilot.platform.clock import FixedClock
from careerpilot.platform.enums import ConnectionStatus, IntegrationProvider, SyncFailure
from careerpilot.platform.errors import DomainError, ErrorCode
from tests.unit.conftest import DEMO_USER
from tests.unit.integrations.conftest import CLIENT_ID, CLIENT_ID_ENV, connect, state_of

PASSWORD = "admin@sober.com"


def query_of(url: str) -> dict[str, list[str]]:
    return parse_qs(urlsplit(url).query)


def test_authorize_url_uses_pkce_offline_access_and_the_configured_scopes(google: Container) -> None:
    url = google.integrations.google.authorize_url(DEMO_USER).url
    query = query_of(url)
    config = google.settings.integrations.google
    assert url.startswith(str(config.authorize_endpoint))
    assert query["client_id"] == [CLIENT_ID]
    assert query["redirect_uri"] == ["http://localhost:8000/v1/integrations/google/callback"]
    assert query["code_challenge_method"] == ["S256"]
    assert len(query["code_challenge"][0]) == 43
    assert query["access_type"] == ["offline"]
    assert query["scope"][0].split() == config.scopes
    assert "code_verifier" not in query


def test_redirect_base_follows_the_environment(google: Container, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv(google.settings.integrations.google.redirect_base_url_env, "https://api.careerpilot.example/")
    query = query_of(google.integrations.google.authorize_url(DEMO_USER).url)
    assert query["redirect_uri"] == ["https://api.careerpilot.example/v1/integrations/google/callback"]


def test_authorize_url_needs_credentials(google: Container, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv(CLIENT_ID_ENV)
    with pytest.raises(DomainError) as refused:
        google.integrations.google.authorize_url(DEMO_USER)
    assert refused.value.code is ErrorCode.SERVICE_UNAVAILABLE
    assert google.integrations.google.status(DEMO_USER).configured is False


def test_callback_stores_the_account_and_returns_to_the_settings_page(google: Container) -> None:
    redirect = connect(google)
    assert redirect == "http://localhost:3000/settings/connected-accounts?google=connected"
    status = google.integrations.google.status(DEMO_USER)
    assert status.connected and status.mail_access and status.calendar_access
    assert status.connection is not None
    assert status.connection.email == "ayesha@gmail.com"
    assert status.connection.status is ConnectionStatus.CONNECTED


def test_tokens_are_encrypted_at_rest_and_never_in_any_view(google: Container, gateway: FakeGoogleGateway) -> None:
    connect(google)
    record = google.integrations.google._ctx.connections.active(DEMO_USER, IntegrationProvider.GOOGLE)  # pyright: ignore[reportPrivateUsage]
    assert record is not None
    assert "access-1" not in record.sealed_tokens and "refresh-auth-code" not in record.sealed_tokens
    shown = google.integrations.google.status(DEMO_USER).model_dump_json() + str(google.integrations.google.views(DEMO_USER))
    assert "access-1" not in shown and "refresh-auth-code" not in shown and record.sealed_tokens not in shown


@pytest.mark.parametrize("state", ["", "not-a-token"])
def test_a_bad_state_stores_nothing(google: Container, state: str) -> None:
    redirect = google.integrations.google.complete(state, "auth-code", None)
    assert redirect.endswith("?google=error&reason=invalid_state")
    assert google.integrations.google.status(DEMO_USER).connected is False


def test_state_is_single_use_and_expires(google: Container, clock: FixedClock) -> None:
    url = google.integrations.google.authorize_url(DEMO_USER).url
    state = state_of(url)
    assert google.integrations.google.complete(state, "auth-code", None).endswith("google=connected")
    assert google.integrations.google.complete(state, "auth-code", None).endswith("reason=invalid_state")
    late = state_of(google.integrations.google.authorize_url(DEMO_USER).url)
    clock.advance(timedelta(minutes=google.settings.integrations.google.state_ttl_minutes + 1))
    assert google.integrations.google.complete(late, "auth-code", None).endswith("reason=invalid_state")


def test_denied_access_and_failed_exchange_store_nothing(google: Container, gateway: FakeGoogleGateway) -> None:
    denied = google.integrations.google.complete(state_of(google.integrations.google.authorize_url(DEMO_USER).url), None, "access_denied")
    assert denied.endswith("reason=access_denied")
    gateway.exchange_failure = SyncFailure.GOOGLE_REJECTED
    failed = google.integrations.google.complete(state_of(google.integrations.google.authorize_url(DEMO_USER).url), "auth-code", None)
    assert failed.endswith("reason=exchange_failed")
    assert google.integrations.google.status(DEMO_USER).connection is None


def test_reconnecting_reuses_the_connection_and_clears_the_error(google: Container) -> None:
    connect(google)
    repo = google.integrations.google._ctx.connections  # pyright: ignore[reportPrivateUsage]
    first = repo.active(DEMO_USER, IntegrationProvider.GOOGLE)
    assert first is not None
    repo.save(first.model_copy(update={"status": ConnectionStatus.NEEDS_RECONNECT, "last_error": SyncFailure.TOKEN_REVOKED}))
    connect(google, "second-code")
    again = repo.active(DEMO_USER, IntegrationProvider.GOOGLE)
    assert again is not None
    assert (again.id, again.status, again.last_error) == (first.id, ConnectionStatus.CONNECTED, None)


def test_disconnect_revokes_at_google_and_forgets_the_connection(google: Container, gateway: FakeGoogleGateway) -> None:
    connect(google)
    google.integrations.google.disconnect(DEMO_USER)
    assert gateway.revoked == ["refresh-auth-code"]
    assert google.integrations.google.status(DEMO_USER).connection is None
    google.integrations.google.disconnect(DEMO_USER)


def test_disconnect_still_removes_the_connection_when_google_fails(google: Container, gateway: FakeGoogleGateway) -> None:
    connect(google)
    gateway.revoke_failure = SyncFailure.GOOGLE_UNAVAILABLE
    google.integrations.google.disconnect(DEMO_USER)
    assert google.integrations.google.status(DEMO_USER).connected is False


def test_the_vault_round_trips_and_rejects_another_key() -> None:
    cipher = FernetCipher("a secret", "context")
    assert cipher.unseal(cipher.seal("token")) == "token"
    with pytest.raises(DomainError):
        FernetCipher("another secret", "context").unseal(cipher.seal("token"))
    with pytest.raises(DomainError):
        FernetCipher("a secret", "other context").unseal(cipher.seal("token"))


def test_the_vault_key_falls_back_to_the_token_secret(google: Container) -> None:
    vault = google.settings.integrations.vault
    assert vault_secret(vault, "token-secret", {}) == "token-secret"
    assert vault_secret(vault, "token-secret", {vault.key_env: "  vault-key "}) == "vault-key"


def user_headers(client: TestClient) -> dict[str, str]:
    token = client.post("/v1/auth/sign-in", json={"email": "admin@sober.com", "password": PASSWORD}).json()["accessToken"]
    return {"Authorization": f"Bearer {token}"}


def test_user_routes_connect_report_and_disconnect_without_tokens(google: Container) -> None:
    client = TestClient(create_user_app(google))
    assert client.get("/v1/integrations/google/authorize-url").status_code == 401
    headers = user_headers(client)
    url = client.get("/v1/integrations/google/authorize-url", headers=headers).json()["url"]
    callback = client.get("/v1/integrations/google/callback", params={"state": state_of(url), "code": "abc"}, follow_redirects=False)
    assert callback.status_code == 307
    assert callback.headers["location"].endswith("google=connected")
    status = client.get("/v1/integrations/google", headers=headers)
    assert status.json()["connection"]["email"] == "ayesha@gmail.com"
    assert "sealedTokens" not in status.text and "access-1" not in status.text and "refresh-abc" not in status.text
    assert client.post("/v1/integrations/google/sync", headers=headers).json() == {"messages": 0, "events": 1}
    assert client.delete("/v1/integrations/google", headers=headers).status_code == 204
    assert client.get("/v1/integrations/google", headers=headers).json()["connected"] is False


def test_callback_without_a_state_returns_with_an_error(google: Container) -> None:
    client = TestClient(create_user_app(google))
    response = client.get("/v1/integrations/google/callback", follow_redirects=False)
    assert response.headers["location"].endswith("reason=invalid_state")


def test_admins_see_connected_accounts_without_tokens(google: Container) -> None:
    connect(google)
    client = TestClient(create_admin_app(google))
    token = client.post("/admin/v1/auth/sign-in", json={"email": "admin@sober.com", "password": PASSWORD}).json()["accessToken"]
    response = client.get(f"/admin/v1/users/{DEMO_USER}/integrations", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    [account] = response.json()
    assert account["email"] == "ayesha@gmail.com" and account["status"] == "connected"
    assert "sealedTokens" not in response.text and "access-1" not in response.text
    missing = client.get("/admin/v1/users/usr_nobody/integrations", headers={"Authorization": f"Bearer {token}"})
    assert missing.status_code == 404
