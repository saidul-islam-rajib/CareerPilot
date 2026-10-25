from dataclasses import dataclass

from careerpilot.candidate.context import USER_AUDIENCE, CandidateContext
from careerpilot.candidate.models import Session, SignInEvent, UserSummary
from careerpilot.candidate.ports import Account
from careerpilot.candidate.services.profile import start_profile
from careerpilot.platform.clock import iso
from careerpilot.platform.coordination import GuardScope, SignInGuard
from careerpilot.platform.enums import UserAccountStatus
from careerpilot.platform.errors import DomainError, ErrorCode, validation_error
from careerpilot.platform.validation import require_email, require_name, require_password

BLOCKED_STATUSES = frozenset({UserAccountStatus.SUSPENDED, UserAccountStatus.DELETED})


@dataclass(frozen=True)
class ClientInfo:
    ip: str
    device: str
    approximate_location: str


@dataclass(frozen=True)
class Registration:
    full_name: str
    email: str
    password: str
    consent: bool
    terms_version: str
    privacy_version: str


class AuthService:
    def __init__(self, context: CandidateContext, guard: SignInGuard) -> None:
        self._ctx = context
        self._guard = guard

    def sign_in(self, email: str, password: str, client: ClientInfo) -> Session:
        self._guard.ensure_allowed(GuardScope.USER, email, client.ip)
        account = self._ctx.accounts.find_by_email(email)
        valid = account is not None and account.status not in BLOCKED_STATUSES and self._ctx.hasher.verify(account.password_hash, password)
        if account is not None:
            self._record_sign_in(account.user.id, client, success=valid)
        if account is None or not valid:
            self._guard.record_failure(GuardScope.USER, email)
            raise DomainError(ErrorCode.INVALID_CREDENTIALS)
        self._guard.clear(GuardScope.USER, email)
        return self._session(account.user)

    def register(self, registration: Registration, client: ClientInfo) -> Session:
        self._guard.throttle(GuardScope.USER, client.ip)
        policy = self._ctx.settings.validation
        if not registration.consent:
            raise validation_error("consent")
        email = require_email(registration.email, policy.email)
        if self._ctx.accounts.find_by_email(email) is not None:
            raise DomainError(ErrorCode.EMAIL_TAKEN)
        user = UserSummary(
            id=self._ctx.ids.next("usr"),
            full_name=require_name(registration.full_name, policy.name),
            email=email,
        )
        self._ctx.accounts.add(
            Account(
                user=user,
                password_hash=self._ctx.hasher.hash(require_password(registration.password, policy.password)),
                status=UserAccountStatus.ACTIVE,
                consent_terms_version=registration.terms_version,
                consent_privacy_version=registration.privacy_version,
            )
        )
        self._start_profile(user)
        self._record_sign_in(user.id, client, success=True)
        return self._session(user)

    def change_password(self, user_id: str, current_password: str, new_password: str) -> None:
        account = self._ctx.accounts.get(user_id)
        if account is None or not self._ctx.hasher.verify(account.password_hash, current_password):
            raise DomainError(ErrorCode.INVALID_CREDENTIALS)
        password = require_password(new_password, self._ctx.settings.validation.password)
        account.password_hash = self._ctx.hasher.hash(password)
        self._ctx.accounts.save(account)

    def _start_profile(self, user: UserSummary) -> None:
        workspace = self._ctx.workspaces.get(user.id)
        start_profile(workspace.profile, user, self._ctx.ids.next("c"))
        self._ctx.workspaces.save(user.id, workspace)

    def request_password_reset(self, email: str, client: ClientInfo) -> None:
        self._guard.throttle(GuardScope.USER, client.ip)
        require_email(email, self._ctx.settings.validation.email)

    def authenticate(self, token: str) -> UserSummary:
        claims = self._ctx.tokens.verify(token, USER_AUDIENCE)
        account = self._ctx.accounts.get(claims.subject)
        if account is None or account.status in BLOCKED_STATUSES:
            raise DomainError(ErrorCode.UNAUTHORIZED)
        return account.user

    def _session(self, user: UserSummary) -> Session:
        token = self._ctx.tokens.issue(user.id, USER_AUDIENCE, self._ctx.settings.security.token_ttl_minutes)
        return Session(access_token=token, user=user)

    def _record_sign_in(self, user_id: str, client: ClientInfo, success: bool) -> None:
        workspace = self._ctx.workspaces.get(user_id)
        workspace.sign_in_events = [e.model_copy(update={"current": False}) for e in workspace.sign_in_events]
        workspace.sign_in_events.insert(
            0,
            SignInEvent(
                id=self._ctx.ids.next("si"),
                at=iso(self._ctx.clock.now()),
                ip=client.ip,
                device=client.device,
                approximate_location=client.approximate_location,
                success=success,
                current=success,
            ),
        )
        self._ctx.workspaces.save(user_id, workspace)
