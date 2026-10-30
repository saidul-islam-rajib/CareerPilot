import base64
import hashlib
import os
import secrets
from collections.abc import Callable, Mapping
from contextlib import suppress
from dataclasses import dataclass, field
from datetime import timedelta
from urllib.parse import urlencode

from careerpilot.integrations.models import (
    AuthorizeUrl,
    ConnectionRecord,
    ConnectionView,
    IntegrationStatus,
    TokenSet,
)
from careerpilot.integrations.ports import ConnectionRepository, GoogleError, GoogleGateway, TokenCipher
from careerpilot.integrations.vault import seal_tokens, unseal_tokens
from careerpilot.platform.clock import Clock, IdGenerator, iso, parse_iso
from careerpilot.platform.config import GoogleConfig, IntegrationsConfig, web_base_url
from careerpilot.platform.coordination import KeyNamespace, KeySpace
from careerpilot.platform.enums import ConnectFailure, ConnectionStatus, IntegrationProvider, SyncFailure
from careerpilot.platform.errors import DomainError, ErrorCode, validation_error
from careerpilot.platform.keyvalue import KeyValueStore
from careerpilot.platform.security import TokenService

CONNECTION_ID_PREFIX = "con"
DISCONNECT_REASON = "disconnected by the user"
SECONDS_PER_MINUTE = 60
CALLBACK_SUCCESS = "connected"
CALLBACK_FAILURE = "error"


@dataclass(frozen=True)
class ConnectionContext:
    config: IntegrationsConfig
    web_base_url: str
    clock: Clock
    ids: IdGenerator
    connections: ConnectionRepository
    gateway: GoogleGateway
    cipher: TokenCipher
    tokens: TokenService
    store: KeyValueStore
    keys: KeySpace
    environ: Mapping[str, str] = field(default_factory=lambda: os.environ)


def view_of(record: ConnectionRecord) -> ConnectionView:
    return ConnectionView(
        provider=record.provider,
        email=record.email,
        status=record.status,
        scopes=record.scopes,
        connected_at=record.connected_at,
        last_sync_at=record.last_sync_at,
        last_error=record.last_error,
    )


def credentials_reader(google: GoogleConfig, environ: Mapping[str, str] = os.environ) -> Callable[[], tuple[str, str]]:
    def read() -> tuple[str, str]:
        return environ.get(google.client_id_env, "").strip(), environ.get(google.client_secret_env, "").strip()

    return read


def challenge_for(verifier: str) -> str:
    digest = hashlib.sha256(verifier.encode()).digest()
    return base64.urlsafe_b64encode(digest).rstrip(b"=").decode()


class TokenKeeper:
    def __init__(self, context: ConnectionContext) -> None:
        self._ctx = context

    def seal(self, tokens: TokenSet) -> str:
        return seal_tokens(self._ctx.cipher, tokens)

    def access(self, record: ConnectionRecord) -> tuple[ConnectionRecord, str]:
        try:
            tokens = unseal_tokens(self._ctx.cipher, record.sealed_tokens)
        except DomainError as error:
            raise GoogleError(SyncFailure.TOKEN_REVOKED) from error
        skew = timedelta(seconds=self._ctx.config.google.refresh_skew_seconds)
        if parse_iso(record.access_expires_at) - skew > self._ctx.clock.now():
            return record, tokens.access_token
        renewed = self._ctx.gateway.refresh(tokens.refresh_token)
        expires_at = iso(self._ctx.clock.now() + timedelta(seconds=renewed.expires_in))
        fresh = TokenSet(renewed.access_token, renewed.refresh_token or tokens.refresh_token, expires_at)
        updated = record.model_copy(update={"sealed_tokens": self.seal(fresh), "access_expires_at": expires_at})
        self._ctx.connections.save(updated)
        return updated, fresh.access_token


class ConnectionService:
    def __init__(self, context: ConnectionContext) -> None:
        self._ctx = context
        self._google = context.config.google
        self._keeper = TokenKeeper(context)
        self._credentials = credentials_reader(self._google, context.environ)

    def configured(self) -> bool:
        return all(self._credentials())

    def redirect_uri(self) -> str:
        configured = self._ctx.environ.get(self._google.redirect_base_url_env, "").strip() or self._google.redirect_base_url
        try:
            base = web_base_url(configured)
        except ValueError as error:
            raise validation_error(self._google.redirect_base_url_env) from error
        return f"{base}{self._google.callback_path}"

    def authorize_url(self, user_id: str) -> AuthorizeUrl:
        if not self.configured():
            raise DomainError(ErrorCode.SERVICE_UNAVAILABLE, ConnectFailure.NOT_CONFIGURED.value)
        verifier = secrets.token_urlsafe(self._google.pkce_verifier_bytes)
        nonce = secrets.token_urlsafe(self._google.pkce_verifier_bytes // 2)
        ttl = self._google.state_ttl_minutes
        self._ctx.store.put(self._state_key(nonce), verifier, ttl * SECONDS_PER_MINUTE)
        state = self._ctx.tokens.issue(user_id, self._google.state_audience, ttl, session_id=nonce)
        query = urlencode(
            {
                "client_id": self._credentials()[0],
                "redirect_uri": self.redirect_uri(),
                "response_type": "code",
                "scope": " ".join(self._google.scopes),
                "state": state,
                "code_challenge": challenge_for(verifier),
                "code_challenge_method": "S256",
                "access_type": "offline",
                "prompt": "consent",
                "include_granted_scopes": "true",
            }
        )
        return AuthorizeUrl(url=f"{self._google.authorize_endpoint}?{query}")

    def complete(self, state: str, code: str | None, denied: str | None) -> str:
        failure = self._finish(state, code, denied)
        return self.return_url(failure)

    def return_url(self, failure: ConnectFailure | None) -> str:
        google = self._google
        base = f"{self._ctx.web_base_url}{google.web_return_path}"
        if failure is None:
            return f"{base}?{urlencode({google.return_flag: CALLBACK_SUCCESS})}"
        return f"{base}?{urlencode({google.return_flag: CALLBACK_FAILURE, google.return_reason: failure.value})}"

    def status(self, user_id: str) -> IntegrationStatus:
        record = self._ctx.connections.active(user_id, IntegrationProvider.GOOGLE)
        if record is None:
            return IntegrationStatus(connected=False, configured=self.configured())
        return IntegrationStatus(
            connected=record.status is ConnectionStatus.CONNECTED,
            configured=self.configured(),
            connection=view_of(record),
            mail_access=self._google.mail_scope in record.scopes,
            calendar_access=self._google.calendar_scope in record.scopes,
        )

    def views(self, user_id: str) -> list[ConnectionView]:
        record = self._ctx.connections.active(user_id, IntegrationProvider.GOOGLE)
        return [view_of(record)] if record else []

    def disconnect(self, user_id: str) -> None:
        record = self._ctx.connections.active(user_id, IntegrationProvider.GOOGLE)
        if record is None:
            return
        with suppress(GoogleError, DomainError):
            self._ctx.gateway.revoke(self._revocable(record))
        self._ctx.connections.remove(user_id, IntegrationProvider.GOOGLE, DISCONNECT_REASON)

    def _revocable(self, record: ConnectionRecord) -> str:
        return unseal_tokens(self._ctx.cipher, record.sealed_tokens).refresh_token

    def _finish(self, state: str, code: str | None, denied: str | None) -> ConnectFailure | None:
        try:
            claims = self._ctx.tokens.verify(state, self._google.state_audience)
        except DomainError:
            return ConnectFailure.INVALID_STATE
        key = self._state_key(claims.session_id)
        verifier = self._ctx.store.get(key)
        self._ctx.store.remove(key)
        if verifier is None:
            return ConnectFailure.INVALID_STATE
        if denied or not code:
            return ConnectFailure.ACCESS_DENIED
        try:
            self._store(claims.subject, code, verifier)
        except GoogleError:
            return ConnectFailure.EXCHANGE_FAILED
        return None

    def _store(self, user_id: str, code: str, verifier: str) -> None:
        issued = self._ctx.gateway.exchange_code(code, verifier, self.redirect_uri())
        if issued.refresh_token is None:
            raise GoogleError(SyncFailure.GOOGLE_REJECTED)
        email = self._ctx.gateway.account_email(issued.access_token)
        now = self._ctx.clock.now()
        expires_at = iso(now + timedelta(seconds=issued.expires_in))
        sealed = self._keeper.seal(TokenSet(issued.access_token, issued.refresh_token, expires_at))
        existing = self._ctx.connections.active(user_id, IntegrationProvider.GOOGLE)
        self._ctx.connections.save(
            ConnectionRecord(
                id=existing.id if existing else self._ctx.ids.next(CONNECTION_ID_PREFIX),
                user_id=user_id,
                provider=IntegrationProvider.GOOGLE,
                email=email,
                status=ConnectionStatus.CONNECTED,
                scopes=sorted(issued.scopes),
                sealed_tokens=sealed,
                access_expires_at=expires_at,
                connected_at=iso(now),
            )
        )

    def _state_key(self, nonce: str) -> str:
        return self._ctx.keys.key(KeyNamespace.OAUTH_STATE, nonce)
