import logging
import smtplib
import ssl
import time
from collections.abc import Callable
from concurrent.futures import Executor, Future
from dataclasses import dataclass, field
from email.message import EmailMessage
from email.utils import formataddr, make_msgid
from typing import Protocol

from careerpilot.platform.enums import DeliveryMode, SmtpSecurity

logger = logging.getLogger(__name__)

MESSAGE_ID = "Message-ID"
MAIN_TYPE_SEPARATOR = "/"
ADDRESS_SEPARATOR = "@"
HTML_SUBTYPE = "html"


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
    html: str | None = None


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
    if email.html:
        message.add_alternative(email.html, subtype=HTML_SUBTYPE)
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


OnFailure = Callable[[DeliveryError], None]


class Courier(Protocol):
    def deliver(self, email: OutgoingEmail, on_failure: OnFailure) -> None: ...


class DirectCourier:
    def __init__(self, sender: EmailSender) -> None:
        self._sender = sender

    def deliver(self, email: OutgoingEmail, on_failure: OnFailure) -> None:
        try:
            self._sender.send(email)
        except DeliveryError as error:
            on_failure(error)
        except DeliveryUncertainError:
            logger.warning("email_delivery_uncertain")


def report_crash(future: Future[None]) -> None:
    error = future.exception()
    if error is not None:
        logger.error("email_delivery_crashed", exc_info=error)


class BackgroundCourier:
    def __init__(
        self,
        sender: EmailSender,
        attempts: int,
        retry_delay_seconds: float,
        runner: Executor,
        sleep: Callable[[float], None] = time.sleep,
    ) -> None:
        self._sender = sender
        self._attempts = attempts
        self._retry_delay_seconds = retry_delay_seconds
        self._runner = runner
        self._sleep = sleep

    def deliver(self, email: OutgoingEmail, on_failure: OnFailure) -> None:
        self._runner.submit(self._attempt, email, on_failure).add_done_callback(report_crash)

    def _attempt(self, email: OutgoingEmail, on_failure: OnFailure) -> None:
        for attempt in range(1, self._attempts + 1):
            try:
                self._sender.send(email)
                return
            except DeliveryUncertainError:
                logger.warning("email_delivery_uncertain", extra={"attempt": attempt})
                return
            except DeliveryError as error:
                if not error.retryable or attempt == self._attempts:
                    logger.warning("email_not_delivered", extra={"reason": error.reason, "attempts": attempt})
                    on_failure(error)
                    return
            self._sleep(self._retry_delay_seconds * attempt)


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
