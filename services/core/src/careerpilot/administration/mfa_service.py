from careerpilot.administration.context import AdminActor, AdminContext
from careerpilot.administration.mfa import (
    looks_like_totp,
    matching_step,
    new_recovery_code,
    new_secret,
    normalized_recovery_code,
    otpauth_uri,
)
from careerpilot.administration.models import MfaEnrolment, RecoveryCodes
from careerpilot.administration.ports import AdminCredential
from careerpilot.integrations.ports import TokenCipher
from careerpilot.platform.coordination import GuardScope, SignInGuard
from careerpilot.platform.errors import DomainError, ErrorCode, conflict, not_found, validation_error


class AdminMfaService:
    def __init__(self, context: AdminContext, guard: SignInGuard, cipher: TokenCipher) -> None:
        self._ctx = context
        self._guard = guard
        self._cipher = cipher
        self._config = context.settings.security.mfa

    def begin(self, actor: AdminActor) -> MfaEnrolment:
        credential = self._credential(actor)
        if credential.account.mfa_enabled:
            raise conflict()
        secret = new_secret(self._config)
        credential.mfa_pending_secret = self._cipher.seal(secret)
        self._ctx.admins.save(credential)
        issuer = self._ctx.settings.branding.product_name
        return MfaEnrolment(secret=secret, otpauth_uri=otpauth_uri(self._config, issuer, credential.account.email, secret))

    def confirm(self, actor: AdminActor, code: str, client_ip: str) -> RecoveryCodes:
        credential = self._credential(actor)
        if credential.mfa_pending_secret is None:
            raise validation_error()
        self._guard.ensure_allowed(GuardScope.ADMIN, credential.account.email, client_ip)
        pending = self._cipher.unseal(credential.mfa_pending_secret)
        step = matching_step(self._config, pending, code.strip(), self._now(), None)
        if step is None:
            self._guard.record_failure(GuardScope.ADMIN, credential.account.email)
            raise DomainError(ErrorCode.INVALID_CREDENTIALS)
        credential.mfa_secret = credential.mfa_pending_secret
        credential.mfa_pending_secret = None
        credential.mfa_last_step = step
        credential.account.mfa_enabled = True
        codes = self._issue_recovery_codes(credential)
        self._ctx.admins.save(credential)
        actor.record("admin.mfa_enrolled", credential.account.email)
        return codes

    def regenerate(self, actor: AdminActor, code: str, client_ip: str) -> RecoveryCodes:
        credential = self._credential(actor)
        if not credential.account.mfa_enabled:
            raise DomainError(ErrorCode.MFA_REQUIRED)
        self.check(credential, code, client_ip)
        codes = self._issue_recovery_codes(credential)
        self._ctx.admins.save(credential)
        actor.record("admin.mfa_recovery_regenerated", credential.account.email)
        return codes

    def check(self, credential: AdminCredential, code: str, client_ip: str) -> None:
        self._guard.ensure_allowed(GuardScope.ADMIN, credential.account.email, client_ip)
        if not self._verify(credential, code.strip()):
            self._guard.record_failure(GuardScope.ADMIN, credential.account.email)
            raise DomainError(ErrorCode.INVALID_CREDENTIALS)
        self._ctx.admins.save(credential)

    def _verify(self, credential: AdminCredential, code: str) -> bool:
        if credential.mfa_secret is None:
            return False
        if looks_like_totp(self._config, code):
            secret = self._cipher.unseal(credential.mfa_secret)
            step = matching_step(self._config, secret, code, self._now(), credential.mfa_last_step)
            if step is None:
                return False
            credential.mfa_last_step = step
            return True
        return self._consume_recovery_code(credential, normalized_recovery_code(code))

    def _consume_recovery_code(self, credential: AdminCredential, code: str) -> bool:
        for stored in credential.mfa_recovery_hashes:
            if self._ctx.hasher.verify(stored, code):
                credential.mfa_recovery_hashes = [h for h in credential.mfa_recovery_hashes if h != stored]
                return True
        return False

    def _issue_recovery_codes(self, credential: AdminCredential) -> RecoveryCodes:
        codes = [new_recovery_code(self._config) for _ in range(self._config.recovery_code_count)]
        credential.mfa_recovery_hashes = [self._ctx.hasher.hash(normalized_recovery_code(c)) for c in codes]
        return RecoveryCodes(codes=codes)

    def _credential(self, actor: AdminActor) -> AdminCredential:
        credential = self._ctx.admins.get(actor.summary.id)
        if credential is None:
            raise not_found()
        return credential

    def _now(self) -> int:
        return int(self._ctx.clock.now().timestamp())
