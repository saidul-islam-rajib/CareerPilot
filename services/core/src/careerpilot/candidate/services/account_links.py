import re
from collections.abc import Callable
from dataclasses import dataclass
from urllib.parse import urlencode

from careerpilot.candidate.context import CandidateContext
from careerpilot.candidate.ports import Account
from careerpilot.platform.config import SECONDS_PER_MINUTE, AccountLinksConfig
from careerpilot.platform.email_delivery import Courier, OutgoingEmail
from careerpilot.platform.enums import AccountEmail, AccountLinkPurpose, UserAccountStatus
from careerpilot.platform.errors import DomainError, ErrorCode, validation_error
from careerpilot.platform.messages import translate
from careerpilot.platform.model import CamelModel
from careerpilot.platform.one_time_codes import CodeCheck, OneTimeCodes

PURPOSE = "account_link"
TOKEN_SEPARATOR = "."
TOKEN_FORMAT = re.compile(r"[A-Za-z0-9_-]{1,64}\.[A-Za-z0-9_-]{16,256}")
TOKEN_PARAMETER = "token"
URL_SEPARATOR = "/"
LINE = "\n"
LINKABLE_STATUSES = frozenset({UserAccountStatus.REGISTERED, UserAccountStatus.ACTIVE, UserAccountStatus.PAUSED})
LINK_ERRORS: dict[CodeCheck, Callable[[], DomainError]] = {
    CodeCheck.INVALID: lambda: validation_error("link_invalid"),
    CodeCheck.EXPIRED: lambda: validation_error("link_expired"),
    CodeCheck.LOCKED: lambda: validation_error("link_expired"),
}


class AccountLinkDetails(CamelModel):
    purpose: AccountLinkPurpose
    full_name: str
    email: str


@dataclass(frozen=True)
class AccountLinkContext:
    candidate: CandidateContext
    codes: OneTimeCodes
    courier: Courier
    ttl_minutes: Callable[[], int]


class AccountLinkPolicy:
    def __init__(self, config: AccountLinksConfig, ttl_minutes: Callable[[], int]) -> None:
        self._config = config
        self._ttl_minutes = ttl_minutes

    @property
    def code_length(self) -> int:
        return self._config.token_bytes

    @property
    def code_ttl_seconds(self) -> int:
        return self._ttl_minutes() * SECONDS_PER_MINUTE

    @property
    def resend_cooldown_seconds(self) -> int:
        return self.code_ttl_seconds

    @property
    def max_attempts(self) -> int:
        return self._config.max_attempts

    @property
    def sends_per_hour(self) -> int:
        return self._config.sends_per_hour


def link_purpose(account: Account) -> AccountLinkPurpose:
    return AccountLinkPurpose.SETUP if account.status is UserAccountStatus.REGISTERED else AccountLinkPurpose.RESET


def link_email(account: Account) -> AccountEmail:
    return AccountEmail.SETUP if account.status is UserAccountStatus.REGISTERED else AccountEmail.RESET


class AccountLinkService:
    def __init__(self, context: AccountLinkContext) -> None:
        self._ctx = context
        self._config = context.candidate.settings.account_links

    def send(self, account: Account, kind: AccountEmail) -> None:
        user_id = account.user.id
        try:
            secret = self._ctx.codes.issue(PURPOSE, user_id)
        except DomainError as error:
            if error.code is ErrorCode.TOO_MANY_ATTEMPTS:
                return
            raise
        email = self._email(account, kind, TOKEN_SEPARATOR.join((user_id, secret)))
        self._ctx.courier.deliver(email, lambda _error: self._ctx.codes.withdraw(PURPOSE, user_id))

    def inspect(self, token: str) -> AccountLinkDetails:
        account = self._verified(token, consume=False)
        return AccountLinkDetails(purpose=link_purpose(account), full_name=account.user.full_name, email=account.user.email)

    def redeem(self, token: str) -> Account:
        account = self._verified(token, consume=True)
        self._ctx.codes.withdraw(PURPOSE, account.user.id)
        return account

    def _verified(self, token: str, consume: bool) -> Account:
        cleaned = token.strip()
        if TOKEN_FORMAT.fullmatch(cleaned) is None:
            raise validation_error("link_invalid")
        user_id, _, secret = cleaned.partition(TOKEN_SEPARATOR)
        account = self._ctx.candidate.accounts.get(user_id)
        if account is None or account.status not in LINKABLE_STATUSES:
            raise validation_error("link_invalid")
        verify = self._ctx.codes.check if consume else self._ctx.codes.peek
        outcome = verify(PURPOSE, user_id, secret)
        if outcome is not CodeCheck.VALID:
            raise LINK_ERRORS[outcome]()
        return account

    def _web_url(self, path: str) -> str:
        return f"{self._ctx.candidate.settings.notifications.web_base_url.rstrip(URL_SEPARATOR)}{path}"

    def _link(self, token: str) -> str:
        return f"{self._web_url(self._config.set_password_path)}?{urlencode({TOKEN_PARAMETER: token})}"

    def _paragraphs(self, kind: AccountEmail, product: str) -> list[str]:
        intro = translate(f"accountLinks.{kind.value}EmailIntro", {"product": product})
        if kind is not AccountEmail.EXISTING:
            return [intro]
        sign_in = translate("accountLinks.existingEmailSignIn", {"url": self._web_url(self._config.sign_in_path)})
        return [intro, sign_in, translate("accountLinks.existingEmailReset")]

    def _email(self, account: Account, kind: AccountEmail, token: str) -> OutgoingEmail:
        settings = self._ctx.candidate.settings
        product = settings.branding.product_name
        paragraphs = [line for paragraph in self._paragraphs(kind, product) for line in (paragraph, "")]
        body = LINE.join(
            (
                translate("accountLinks.emailGreeting", {"name": account.user.full_name}),
                "",
                *paragraphs,
                self._link(token),
                "",
                translate("accountLinks.emailExpiry", {"minutes": self._ctx.ttl_minutes()}),
                translate("accountLinks.emailIgnore"),
                "",
                translate("email.credit", {"url": str(settings.branding.developer_url)}),
            )
        )
        return OutgoingEmail(
            sender_name=product,
            sender_address=settings.mail.sender_address,
            reply_to=settings.mail.sender_address,
            to=account.user.email,
            subject=translate(f"accountLinks.{kind.value}EmailSubject", {"product": product}),
            body=body,
        )
