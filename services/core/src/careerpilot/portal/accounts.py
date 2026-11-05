import secrets
from dataclasses import dataclass

from careerpilot.integrations.ports import TokenCipher
from careerpilot.platform.clock import Clock, IdGenerator, iso
from careerpilot.platform.errors import not_found, validation_error
from careerpilot.portal.config import PasswordPolicy, PortalsConfig
from careerpilot.portal.enums import AccountOrigin, AccountStatus, Failure, RecordKind
from careerpilot.portal.models import AccountInput, AccountSecret, AccountView, PortalAccount
from careerpilot.portal.ports import PortalRecordRepository
from careerpilot.portal.store import RecordStore

ACCOUNT_PREFIX = "pac"
DELETED_BY_USER = "portal_account_deleted_by_user"
REPLACED = "portal_account_replaced"


def generate_password(policy: PasswordPolicy) -> str:
    groups = [policy.lowercase, policy.uppercase, policy.digits, policy.symbols]
    pool = "".join(groups)
    chars = [secrets.choice(group) for group in groups]
    chars.extend(secrets.choice(pool) for _ in range(policy.length - len(chars)))
    secrets.SystemRandom().shuffle(chars)
    return "".join(chars)


def view_of(account: PortalAccount) -> AccountView:
    return AccountView(
        id=account.id,
        host=account.host,
        employer=account.employer,
        email=account.email,
        status=account.status,
        origin=account.origin,
        site_url=account.site_url,
        created_at=account.created_at,
        last_used_at=account.last_used_at,
    )


@dataclass(frozen=True)
class AccountsContext:
    config: PortalsConfig
    clock: Clock
    ids: IdGenerator
    records: PortalRecordRepository
    cipher: TokenCipher


class PortalAccounts:
    def __init__(self, context: AccountsContext) -> None:
        self._ctx = context
        self._store = RecordStore(context.records, RecordKind.ACCOUNT, PortalAccount)

    def views(self, user_id: str) -> list[AccountView]:
        return [view_of(a) for a in sorted(self._store.all(user_id), key=lambda a: a.created_at)]

    def find(self, user_id: str, host: str) -> PortalAccount | None:
        return next((a for a in self._store.all(user_id) if a.host == host.lower()), None)

    def create(self, user_id: str, host: str, employer: str, email: str, site_url: str) -> tuple[PortalAccount, str]:
        password = generate_password(self._ctx.config.password)
        account = self._new(user_id, host, employer, email, password, AccountOrigin.CREATED, site_url)
        return account, password

    def import_credential(self, user_id: str, body: AccountInput) -> AccountView:
        existing = self.find(user_id, body.host)
        if existing is not None:
            self._store.remove(user_id, existing.id, REPLACED)
        account = self._new(user_id, body.host, body.employer, body.email, body.password, AccountOrigin.IMPORTED, body.site_url)
        return view_of(account)

    def password_of(self, account: PortalAccount) -> str:
        return self._ctx.cipher.unseal(account.sealed_password)

    def reveal(self, user_id: str, account_id: str) -> AccountSecret:
        account = self._require(user_id, account_id)
        return AccountSecret(id=account.id, host=account.host, email=account.email, password=self.password_of(account))

    def export(self, user_id: str) -> list[AccountSecret]:
        return [AccountSecret(id=a.id, host=a.host, email=a.email, password=self.password_of(a)) for a in self._store.all(user_id)]

    def remove(self, user_id: str, account_id: str) -> None:
        self._require(user_id, account_id)
        self._store.remove(user_id, account_id, DELETED_BY_USER)

    def discard(self, user_id: str, account_id: str, reason: str) -> None:
        self._store.remove(user_id, account_id, reason)

    def record_login_attempt(self, user_id: str, account: PortalAccount) -> PortalAccount:
        updated = account.model_copy(update={"login_attempts": account.login_attempts + 1, "last_used_at": iso(self._ctx.clock.now())})
        return self._store.save(user_id, account.id, updated)

    def login_allowed(self, account: PortalAccount) -> bool:
        return account.status is AccountStatus.ACTIVE and account.login_attempts < self._ctx.config.limits.max_login_attempts

    def mark_signed_in(self, user_id: str, account: PortalAccount) -> None:
        self._store.save(user_id, account.id, account.model_copy(update={"login_attempts": 0, "status": AccountStatus.ACTIVE}))

    def mark_needs_attention(self, user_id: str, account: PortalAccount) -> None:
        self._store.save(user_id, account.id, account.model_copy(update={"status": AccountStatus.NEEDS_ATTENTION}))

    def _new(self, user_id: str, host: str, employer: str, email: str, password: str, origin: AccountOrigin, site_url: str) -> PortalAccount:
        if not host.strip() or not email.strip() or not password:
            raise validation_error(Failure.INVALID_HOST.value)
        account = PortalAccount(
            id=self._ctx.ids.next(ACCOUNT_PREFIX),
            host=host.strip().lower(),
            employer=employer.strip(),
            email=email.strip(),
            sealed_password=self._ctx.cipher.seal(password),
            origin=origin,
            site_url=site_url,
            created_at=iso(self._ctx.clock.now()),
        )
        return self._store.save(user_id, account.id, account)

    def _require(self, user_id: str, account_id: str) -> PortalAccount:
        account = self._store.get(user_id, account_id)
        if account is None:
            raise not_found(RecordKind.ACCOUNT.value)
        return account
