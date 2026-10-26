from collections.abc import Callable
from dataclasses import dataclass
from urllib.parse import urlencode

from careerpilot.candidate.context import CandidateContext
from careerpilot.candidate.ports import Account
from careerpilot.platform.email_delivery import DeliveryError, DeliveryUncertainError, EmailSender, OutgoingEmail
from careerpilot.platform.enums import AccountLinkPurpose, UserAccountStatus
from careerpilot.platform.errors import DomainError, ErrorCode, validation_error
from careerpilot.platform.messages import translate
from careerpilot.platform.model import CamelModel
from careerpilot.platform.one_time_codes import CodeCheck, OneTimeCodes

PURPOSE = "account_link"
TOKEN_SEPARATOR = "."
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
    sender: EmailSender


def link_purpose(account: Account) -> AccountLinkPurpose:
    return AccountLinkPurpose.SETUP if account.status is UserAccountStatus.REGISTERED else AccountLinkPurpose.RESET


class AccountLinkService:
    def __init__(self, context: AccountLinkContext) -> None:
        self._ctx = context
        self._config = context.candidate.settings.account_links

    def send(self, account: Account) -> None:
        user_id = account.user.id
        try:
            secret = self._ctx.codes.issue(PURPOSE, user_id)
        except DomainError as error:
            if error.code is ErrorCode.TOO_MANY_ATTEMPTS:
                return
            raise
        try:
            self._ctx.sender.send(self._email(account, TOKEN_SEPARATOR.join((user_id, secret))))
        except (DeliveryError, DeliveryUncertainError) as error:
            self._ctx.codes.withdraw(PURPOSE, user_id)
            raise DomainError(ErrorCode.SERVICE_UNAVAILABLE, "delivery_failed") from error

    def inspect(self, token: str) -> AccountLinkDetails:
        account = self._verified(token, consume=False)
        return AccountLinkDetails(purpose=link_purpose(account), full_name=account.user.full_name, email=account.user.email)

    def redeem(self, token: str) -> Account:
        return self._verified(token, consume=True)

    def _verified(self, token: str, consume: bool) -> Account:
        user_id, _, secret = token.strip().partition(TOKEN_SEPARATOR)
        account = self._ctx.candidate.accounts.get(user_id) if user_id and secret else None
        if account is None or account.status not in LINKABLE_STATUSES:
            raise validation_error("link_invalid")
        verify = self._ctx.codes.check if consume else self._ctx.codes.peek
        outcome = verify(PURPOSE, user_id, secret)
        if outcome is not CodeCheck.VALID:
            raise LINK_ERRORS[outcome]()
        return account

    def _link(self, token: str) -> str:
        base = self._ctx.candidate.settings.notifications.web_base_url.rstrip(URL_SEPARATOR)
        return f"{base}{self._config.set_password_path}?{urlencode({TOKEN_PARAMETER: token})}"

    def _email(self, account: Account, token: str) -> OutgoingEmail:
        settings = self._ctx.candidate.settings
        purpose = link_purpose(account).value
        product = settings.branding.product_name
        body = LINE.join(
            (
                translate("accountLinks.emailGreeting", {"name": account.user.full_name}),
                "",
                translate(f"accountLinks.{purpose}EmailIntro", {"product": product}),
                "",
                self._link(token),
                "",
                translate("accountLinks.emailExpiry", {"minutes": self._config.ttl_minutes}),
                translate("accountLinks.emailIgnore"),
                "",
                translate("email.credit", {"url": str(settings.branding.developer_url)}),
            )
        )
        return OutgoingEmail(
            sender_name=product,
            sender_address=settings.submission.sender_address,
            reply_to=settings.submission.sender_address,
            to=account.user.email,
            subject=translate(f"accountLinks.{purpose}EmailSubject", {"product": product}),
            body=body,
        )
