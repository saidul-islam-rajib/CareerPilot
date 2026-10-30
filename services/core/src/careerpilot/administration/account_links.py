import logging
import os
from collections.abc import Callable, Mapping
from dataclasses import dataclass

from careerpilot.administration.context import AdminContext
from careerpilot.administration.models import AdminAccount
from careerpilot.administration.ports import AdminCredential
from careerpilot.platform.email_delivery import Courier, OutgoingEmail
from careerpilot.platform.email_html import EmailLink, render_html
from careerpilot.platform.enums import AdminRole
from careerpilot.platform.errors import DomainError, ErrorCode, validation_error
from careerpilot.platform.links import LINK_ERRORS, LINK_INVALID, join_token, link_url, split_token
from careerpilot.platform.messages import translate
from careerpilot.platform.model import CamelModel
from careerpilot.platform.one_time_codes import CodeCheck, OneTimeCodes
from careerpilot.platform.validation import require_email

logger = logging.getLogger(__name__)

PURPOSE = "admin_link"
ADMIN_ID_PREFIX = "adm"
UNSET_PASSWORD = ""
LINE = "\n"


class AdminLinkDetails(CamelModel):
    full_name: str
    email: str


@dataclass(frozen=True)
class AdminLinkContext:
    admin: AdminContext
    codes: OneTimeCodes
    courier: Courier
    ttl_minutes: Callable[[], int]


class AdminLinkService:
    def __init__(self, context: AdminLinkContext) -> None:
        self._ctx = context
        self._config = context.admin.settings.account_links

    def send(self, credential: AdminCredential) -> None:
        admin_id = credential.account.id
        try:
            secret = self._ctx.codes.issue(PURPOSE, admin_id)
        except DomainError as error:
            if error.code is ErrorCode.TOO_MANY_ATTEMPTS:
                return
            raise
        email = self._email(credential.account, join_token(admin_id, secret))
        self._ctx.courier.deliver(email, lambda _error: self._ctx.codes.withdraw(PURPOSE, admin_id))

    def inspect(self, token: str) -> AdminLinkDetails:
        account = self._verified(token, consume=False).account
        return AdminLinkDetails(full_name=account.full_name, email=account.email)

    def redeem(self, token: str) -> AdminCredential:
        credential = self._verified(token, consume=True)
        self._ctx.codes.withdraw(PURPOSE, credential.account.id)
        return credential

    def _verified(self, token: str, consume: bool) -> AdminCredential:
        admin_id, secret = split_token(token)
        credential = self._ctx.admin.admins.get(admin_id)
        if credential is None or credential.account.suspended:
            raise validation_error(LINK_INVALID)
        verify = self._ctx.codes.check if consume else self._ctx.codes.peek
        outcome = verify(PURPOSE, admin_id, secret)
        if outcome is not CodeCheck.VALID:
            raise LINK_ERRORS[outcome]()
        return credential

    def _email(self, account: AdminAccount, token: str) -> OutgoingEmail:
        settings = self._ctx.admin.settings
        product = settings.branding.product_name
        body = LINE.join(
            (
                translate("accountLinks.emailGreeting", {"name": account.full_name}),
                "",
                translate("adminLinks.emailIntro", {"product": product}),
                "",
                link_url(self._config.admin_web_base_url, self._config.set_password_path, token),
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
            to=account.email,
            subject=translate("adminLinks.emailSubject", {"product": product}),
            body=body,
            html=render_html(
                settings.account.locale,
                [
                    translate("accountLinks.emailGreeting", {"name": account.full_name}),
                    translate("adminLinks.emailIntro", {"product": product}),
                    EmailLink(
                        translate("adminLinks.linkLabel"), link_url(self._config.admin_web_base_url, self._config.set_password_path, token)
                    ),
                    translate("accountLinks.emailExpiry", {"minutes": self._ctx.ttl_minutes()}),
                    translate("accountLinks.emailIgnore"),
                    translate("email.credit", {"url": str(settings.branding.developer_url)}),
                ],
            ),
        )


def invite_owner(context: AdminContext, links: AdminLinkService, environ: Mapping[str, str] = os.environ) -> bool:
    configured = environ.get(context.settings.account_links.owner_email_env, "").strip()
    if not configured or context.admins.list_all():
        return False
    try:
        email = require_email(configured, context.settings.validation.email)
    except DomainError:
        logger.warning("owner_email_invalid")
        return False
    owner = AdminAccount(
        id=context.ids.next(ADMIN_ID_PREFIX),
        full_name=translate("adminLinks.ownerName"),
        email=email,
        role=AdminRole.SUPER_ADMIN,
        suspended=False,
        mfa_enabled=False,
    )
    credential = AdminCredential(account=owner, password_hash=UNSET_PASSWORD)
    context.admins.save(credential)
    links.send(credential)
    return True
