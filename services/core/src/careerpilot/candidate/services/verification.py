from collections.abc import Callable
from dataclasses import dataclass
from datetime import timedelta

from careerpilot.candidate.context import CandidateContext
from careerpilot.candidate.models import Contact, Profile
from careerpilot.candidate.ports import CandidateWorkspace
from careerpilot.platform.clock import iso
from careerpilot.platform.coordination import fingerprint
from careerpilot.platform.email_delivery import DeliveryError, DeliveryUncertainError, EmailSender, OutgoingEmail
from careerpilot.platform.enums import ContactKind
from careerpilot.platform.errors import DomainError, ErrorCode, conflict, not_found, validation_error
from careerpilot.platform.messages import translate
from careerpilot.platform.model import CamelModel
from careerpilot.platform.one_time_codes import CodeCheck, OneTimeCodes

PURPOSE = "contact"
TARGET_SEPARATOR = ":"
MASK = "•••"
EMAIL_AT = "@"
LINE = "\n"
SECONDS_PER_MINUTE = 60
VISIBLE_PHONE_DIGITS = 3
CHECK_ERRORS: dict[CodeCheck, Callable[[], DomainError]] = {
    CodeCheck.INVALID: lambda: validation_error("code_invalid"),
    CodeCheck.EXPIRED: lambda: validation_error("code_expired"),
    CodeCheck.LOCKED: lambda: DomainError(ErrorCode.TOO_MANY_ATTEMPTS, "attempts"),
}


class VerificationChallenge(CamelModel):
    destination: str
    expires_at: str
    resend_after_seconds: int


@dataclass(frozen=True)
class VerificationContext:
    candidate: CandidateContext
    codes: OneTimeCodes
    sender: EmailSender


def mask_destination(contact: Contact) -> str:
    if contact.kind is ContactKind.EMAIL and EMAIL_AT in contact.value:
        local, domain = contact.value.split(EMAIL_AT, 1)
        return f"{local[:1]}{MASK}{EMAIL_AT}{domain}"
    return f"{MASK}{contact.value[-VISIBLE_PHONE_DIGITS:]}"


class ContactVerificationService:
    def __init__(self, context: VerificationContext) -> None:
        self._ctx = context
        self._config = context.candidate.settings.verification

    def send(self, user_id: str, contact_id: str) -> VerificationChallenge:
        workspace = self._ctx.candidate.workspaces.get(user_id)
        contact = self._unverified(workspace, contact_id)
        target = self._target(user_id, contact)
        code = self._ctx.codes.issue(PURPOSE, target)
        try:
            self._ctx.sender.send(self._email(workspace, contact, code))
        except (DeliveryError, DeliveryUncertainError) as error:
            self._ctx.codes.withdraw(PURPOSE, target)
            raise DomainError(ErrorCode.SERVICE_UNAVAILABLE, "delivery_failed") from error
        expires = self._ctx.candidate.clock.now() + timedelta(seconds=self._config.code_ttl_seconds)
        return VerificationChallenge(
            destination=mask_destination(contact),
            expires_at=iso(expires),
            resend_after_seconds=self._ctx.codes.resend_after(PURPOSE, target),
        )

    def confirm(self, user_id: str, contact_id: str, code: str) -> Profile:
        workspace = self._ctx.candidate.workspaces.get(user_id)
        contact = self._unverified(workspace, contact_id)
        outcome = self._ctx.codes.check(PURPOSE, self._target(user_id, contact), code)
        if outcome is not CodeCheck.VALID:
            raise CHECK_ERRORS[outcome]()
        profile = workspace.profile
        profile.contacts = [c.model_copy(update={"verified": True}) if c.id == contact.id else c for c in profile.contacts]
        self._ctx.candidate.workspaces.save(user_id, workspace)
        return profile

    def _unverified(self, workspace: CandidateWorkspace, contact_id: str) -> Contact:
        contact = next((c for c in workspace.profile.active_contacts() if c.id == contact_id), None)
        if contact is None:
            raise not_found("contact")
        if contact.verified:
            raise conflict("already_verified")
        if contact.kind is ContactKind.PHONE and not self._config.sms_enabled:
            raise DomainError(ErrorCode.SERVICE_UNAVAILABLE, "sms_unavailable")
        return contact

    @staticmethod
    def _target(user_id: str, contact: Contact) -> str:
        return TARGET_SEPARATOR.join((user_id, contact.id, fingerprint(contact.value)))

    def _email(self, workspace: CandidateWorkspace, contact: Contact, code: str) -> OutgoingEmail:
        settings = self._ctx.candidate.settings
        body = LINE.join(
            (
                translate("verification.emailGreeting", {"name": workspace.profile.full_name}),
                "",
                translate("verification.emailIntro", {"destination": contact.value}),
                "",
                code,
                "",
                translate("verification.emailExpiry", {"minutes": self._config.code_ttl_seconds // SECONDS_PER_MINUTE}),
                "",
                translate("email.credit", {"url": str(settings.branding.developer_url)}),
            )
        )
        return OutgoingEmail(
            sender_name=settings.branding.product_name,
            sender_address=settings.submission.sender_address,
            reply_to=settings.submission.sender_address,
            to=contact.value,
            subject=translate("verification.emailSubject"),
            body=body,
        )
