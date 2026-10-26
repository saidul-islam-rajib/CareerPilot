import smtplib
import ssl
from collections.abc import Callable
from dataclasses import dataclass, field
from email.message import EmailMessage
from email.utils import formataddr, make_msgid
from typing import Protocol

from careerpilot.platform.enums import DeliveryMode, SmtpSecurity

MESSAGE_ID = "Message-ID"
MAIN_TYPE_SEPARATOR = "/"
ADDRESS_SEPARATOR = "@"


@dataclass(frozen=True)
class Attachment:
    name: str
    content: bytes
    content_type: str


@dataclass(frozen=True)
class OutgoingEmail:
    sender_name: str
    sender_address: str
    reply_to: str
    to: str
    subject: str
    body: str
    attachments: list[Attachment] = field(default_factory=list[Attachment])


@dataclass(frozen=True)
class SentReceipt:
    message_id: str


class DeliveryError(Exception):
    def __init__(self, reason: str, retryable: bool) -> None:
        super().__init__(reason)
        self.reason = reason
        self.retryable = retryable


class DeliveryUncertainError(Exception):
    pass


class EmailSender(Protocol):
    def send(self, email: OutgoingEmail) -> SentReceipt: ...


def build_message(email: OutgoingEmail) -> EmailMessage:
    message = EmailMessage()
    message["From"] = formataddr((email.sender_name, email.sender_address))
    message["Reply-To"] = email.reply_to
    message["To"] = email.to
    message["Subject"] = email.subject
    message[MESSAGE_ID] = make_msgid(domain=email.sender_address.rsplit(ADDRESS_SEPARATOR, 1)[-1])
    message.set_content(email.body)
    for attachment in email.attachments:
        maintype, subtype = attachment.content_type.split(MAIN_TYPE_SEPARATOR, 1)
        message.add_attachment(attachment.content, maintype=maintype, subtype=subtype, filename=attachment.name)
    return message


SmtpFactory = Callable[[str, int, float], smtplib.SMTP]


def connect_smtp(host: str, port: int, timeout: float) -> smtplib.SMTP:
    return smtplib.SMTP(host, port, timeout=timeout)


def connect_smtp_tls(host: str, port: int, timeout: float) -> smtplib.SMTP:
    return smtplib.SMTP_SSL(host, port, timeout=timeout, context=ssl.create_default_context())


@dataclass(frozen=True)
class SmtpLogin:
    user: str
    password: str = field(repr=False)


@dataclass(frozen=True)
class SmtpSettings:
    host: str
    port: int
    timeout_seconds: float
    mode: DeliveryMode
    sandbox_hosts: frozenset[str]
    security: SmtpSecurity = SmtpSecurity.NONE
    login: SmtpLogin | None = None


class SmtpEmailSender:
    def __init__(self, settings: SmtpSettings, connect: SmtpFactory = connect_smtp) -> None:
        self._settings = settings
        self._connect = connect

    def send(self, email: OutgoingEmail) -> SentReceipt:
        settings = self._settings
        if settings.mode is DeliveryMode.SANDBOX and settings.host not in settings.sandbox_hosts:
            raise DeliveryError("sandbox_host_refused", retryable=False)
        message = build_message(email)
        try:
            client = self._connect(settings.host, settings.port, settings.timeout_seconds)
        except (OSError, smtplib.SMTPException) as error:
            raise DeliveryError(type(error).__name__, retryable=True) from error
        try:
            self._secure(client)
            refused = self._deliver(client, message)
        finally:
            self._close(client)
        if refused:
            raise DeliveryError("recipients_refused", retryable=False)
        return SentReceipt(message_id=str(message[MESSAGE_ID]))

    def _secure(self, client: smtplib.SMTP) -> None:
        settings = self._settings
        try:
            if settings.security is SmtpSecurity.STARTTLS:
                client.starttls(context=ssl.create_default_context())
            if settings.login is not None:
                client.login(settings.login.user, settings.login.password)
        except smtplib.SMTPAuthenticationError as error:
            raise DeliveryError(type(error).__name__, retryable=False) from error
        except (OSError, smtplib.SMTPException) as error:
            raise DeliveryError(type(error).__name__, retryable=True) from error

    @staticmethod
    def _deliver(client: smtplib.SMTP, message: EmailMessage) -> dict[str, tuple[int, bytes]]:
        try:
            return client.send_message(message)
        except (smtplib.SMTPRecipientsRefused, smtplib.SMTPSenderRefused) as error:
            raise DeliveryError(type(error).__name__, retryable=False) from error
        except (OSError, smtplib.SMTPException) as error:
            raise DeliveryUncertainError(type(error).__name__) from error

    @staticmethod
    def _close(client: smtplib.SMTP) -> None:
        try:
            client.quit()
        except (OSError, smtplib.SMTPException):
            client.close()


def recipient_domain(address: str) -> str:
    return address.rsplit(ADDRESS_SEPARATOR, 1)[-1].strip().lower()


class RecipientRoutingSender:
    def __init__(self, live: EmailSender, sandbox: EmailSender, sandbox_domains: frozenset[str]) -> None:
        self._live = live
        self._sandbox = sandbox
        self._sandbox_domains = frozenset(d.lower() for d in sandbox_domains)

    def send(self, email: OutgoingEmail) -> SentReceipt:
        sender = self._sandbox if recipient_domain(email.to) in self._sandbox_domains else self._live
        return sender.send(email)


class InMemoryEmailSender:
    def __init__(self) -> None:
        self.sent: list[OutgoingEmail] = []
        self.failures: list[Exception] = []

    def send(self, email: OutgoingEmail) -> SentReceipt:
        if self.failures:
            raise self.failures.pop(0)
        self.sent.append(email)
        return SentReceipt(message_id=f"<in-memory-{len(self.sent)}@careerpilot>")
