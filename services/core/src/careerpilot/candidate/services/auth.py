from dataclasses import dataclass, replace
from typing import Protocol

from careerpilot.candidate.context import USER_AUDIENCE, CandidateContext
from careerpilot.candidate.models import Session, SignInEvent, UserSummary
from careerpilot.candidate.ports import Account
from careerpilot.candidate.services.account_links import LINKABLE_STATUSES, AccountLinkDetails, AccountLinkService, link_email
from careerpilot.candidate.services.profile import start_profile
from careerpilot.platform.clock import iso, parse_iso
from careerpilot.platform.coordination import GuardScope, SignInGuard
from careerpilot.platform.enums import AccountEmail, UserAccountStatus
from careerpilot.platform.errors import DomainError, ErrorCode, validation_error
from careerpilot.platform.security import TokenClaims
from careerpilot.platform.validation import require_email, require_name, require_password

BLOCKED_STATUSES = frozenset({UserAccountStatus.REGISTERED, UserAccountStatus.SUSPENDED, UserAccountStatus.DELETED})


@dataclass(frozen=True)
class ClientInfo:
    ip: str
    device: str
    approximate_location: str


@dataclass(frozen=True)
class Registration:
    full_name: str
    email: str
    consent: bool
    terms_version: str
    privacy_version: str


class SessionLog(Protocol):
    def started(self, user_id: str, session_id: str, client: ClientInfo) -> None: ...

    def ended(self, user_id: str, session_id: str) -> None: ...


class NoSessionLog:
    def started(self, user_id: str, session_id: str, client: ClientInfo) -> None:
        return None

    def ended(self, user_id: str, session_id: str) -> None:
        return None


def session_key(claims: TokenClaims) -> str:
    return claims.session_id or f"{claims.subject}-{claims.issued_at}"


def sessions_revoked(account: Account, claims: TokenClaims) -> bool:
    changed = account.credentials_changed_at
    return changed is not None and claims.issued_at < int(parse_iso(changed).timestamp())


class AuthService:
    def __init__(
        self, context: CandidateContext, guard: SignInGuard, links: AccountLinkService, sessions: SessionLog | None = None
    ) -> None:
        self._ctx = context
        self._guard = guard
        self._links = links
        self._sessions = sessions or NoSessionLog()

    def sign_in(self, email: str, password: str, client: ClientInfo) -> Session:
        self._guard.ensure_allowed(GuardScope.USER, email, client.ip)
        account = self._ctx.accounts.find_by_email(email)
        valid = account is not None and account.status not in BLOCKED_STATUSES and self._ctx.hasher.verify(account.password_hash, password)
        event = ""
        if account is not None and account.status is not UserAccountStatus.REGISTERED:
            event = self._record_sign_in(account.user.id, client, success=valid)
        if account is None or not valid:
            self._guard.record_failure(GuardScope.USER, email)
            raise DomainError(ErrorCode.INVALID_CREDENTIALS)
        self._guard.clear(GuardScope.USER, email)
        return self._session(account.user, event, client)

    def register(self, registration: Registration, client: ClientInfo) -> None:
        self._guard.throttle(GuardScope.USER, client.ip)
        policy = self._ctx.settings.validation
        if not registration.consent:
            raise validation_error("consent")
        email = require_email(registration.email, policy.email)
        full_name = require_name(registration.full_name, policy.name)
        existing = self._ctx.accounts.find_by_email(email)
        if existing is not None and existing.status is not UserAccountStatus.REGISTERED:
            if existing.status in LINKABLE_STATUSES:
                self._links.send(existing, AccountEmail.EXISTING)
            return
        consent = self._consent(registration, client)
        if existing is None:
            account = Account(
                user=UserSummary(id=self._ctx.ids.next("usr"), full_name=full_name, email=email),
                password_hash="",
                status=UserAccountStatus.REGISTERED,
                **consent,
            )
            self._ctx.accounts.add(account)
        else:
            account = replace(existing, user=existing.user.model_copy(update={"full_name": full_name}), **consent)
            self._ctx.accounts.save(account)
        self._links.send(account, AccountEmail.SETUP)

    def request_password_reset(self, email: str, client: ClientInfo) -> None:
        self._guard.throttle(GuardScope.USER, client.ip)
        account = self._ctx.accounts.find_by_email(require_email(email, self._ctx.settings.validation.email))
        if account is not None and account.status in LINKABLE_STATUSES:
            self._links.send(account, link_email(account))

    def inspect_link(self, token: str, client: ClientInfo) -> AccountLinkDetails:
        self._guard.throttle(GuardScope.USER, client.ip)
        return self._links.inspect(token)

    def complete_link(self, token: str, password: str, client: ClientInfo) -> Session:
        self._guard.throttle(GuardScope.USER, client.ip)
        chosen = require_password(password, self._ctx.settings.validation.password)
        account = self._links.redeem(token)
        activating = account.status is UserAccountStatus.REGISTERED
        account.password_hash = self._ctx.hasher.hash(chosen)
        account.credentials_changed_at = iso(self._ctx.clock.now())
        if activating:
            account.status = UserAccountStatus.ACTIVE
        self._ctx.accounts.save(account)
        if activating:
            self._start_profile(account.user)
        self._guard.clear(GuardScope.USER, account.user.email)
        event = self._record_sign_in(account.user.id, client, success=True)
        return self._session(account.user, event, client)

    def change_password(self, user_id: str, current_password: str, new_password: str) -> None:
        account = self._ctx.accounts.get(user_id)
        if account is None or not self._ctx.hasher.verify(account.password_hash, current_password):
            raise DomainError(ErrorCode.INVALID_CREDENTIALS)
        password = require_password(new_password, self._ctx.settings.validation.password)
        account.password_hash = self._ctx.hasher.hash(password)
        self._ctx.accounts.save(account)

    def authenticate(self, token: str) -> UserSummary:
        return self.authenticate_session(token)[0]

    def authenticate_session(self, token: str) -> tuple[UserSummary, str]:
        claims = self._ctx.tokens.verify(token, USER_AUDIENCE)
        account = self._ctx.accounts.get(claims.subject)
        if account is None or account.status in BLOCKED_STATUSES or sessions_revoked(account, claims):
            raise DomainError(ErrorCode.UNAUTHORIZED)
        return account.user, session_key(claims)

    def sign_out(self, token: str) -> None:
        user, session_id = self.authenticate_session(token)
        self._sessions.ended(user.id, session_id)

    def _consent(self, registration: Registration, client: ClientInfo) -> dict[str, str]:
        return {
            "consent_terms_version": registration.terms_version,
            "consent_privacy_version": registration.privacy_version,
            "consent_at": iso(self._ctx.clock.now()),
            "consent_ip": client.ip,
            "consent_device": client.device,
        }

    def _start_profile(self, user: UserSummary) -> None:
        workspace = self._ctx.workspaces.get(user.id)
        start_profile(workspace.profile, user, self._ctx.ids.next("c"))
        self._ctx.workspaces.save(user.id, workspace)

    def _session(self, user: UserSummary, event: str, client: ClientInfo) -> Session:
        session_id = event or self._ctx.ids.next("si")
        token = self._ctx.tokens.issue(user.id, USER_AUDIENCE, self._ctx.settings.security.token_ttl_minutes, session_id)
        self._sessions.started(user.id, session_id, client)
        return Session(access_token=token, user=user)

    def _record_sign_in(self, user_id: str, client: ClientInfo, success: bool) -> str:
        workspace = self._ctx.workspaces.get(user_id)
        workspace.sign_in_events = [e.model_copy(update={"current": False}) for e in workspace.sign_in_events]
        event_id = self._ctx.ids.next("si")
        workspace.sign_in_events.insert(
            0,
            SignInEvent(
                id=event_id,
                at=iso(self._ctx.clock.now()),
                ip=client.ip,
                device=client.device,
                approximate_location=client.approximate_location,
                success=success,
                current=success,
            ),
        )
        self._ctx.workspaces.save(user_id, workspace)
        return event_id
