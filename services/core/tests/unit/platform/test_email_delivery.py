import smtplib
import threading
from collections.abc import Callable
from concurrent.futures import Executor, Future, ThreadPoolExecutor
from email.message import EmailMessage
from typing import cast

import pytest

from careerpilot import bootstrap
from careerpilot.bootstrap import account_sender_for
from careerpilot.platform.config import load_settings
from careerpilot.platform.email_delivery import (
    BackgroundCourier,
    DeliveryError,
    DeliveryUncertainError,
    DirectCourier,
    InMemoryEmailSender,
    OutgoingEmail,
    RecipientRoutingSender,
    SentReceipt,
    SmtpEmailSender,
    SmtpLogin,
    SmtpSettings,
    build_message,
)
from careerpilot.platform.email_html import EmailLink, render_html
from careerpilot.platform.enums import DeliveryMode, SmtpSecurity

USER = "sender@gmail.com"
SECRET = "app-password-1234"
CREDENTIALS = {"CAREERPILOT_MAIL_USER": USER, "CAREERPILOT_MAIL_PASSWORD": SECRET}


def email_to(address: str) -> OutgoingEmail:
    return OutgoingEmail(
        sender_name="CareerPilot", sender_address="info@team-sober.com", reply_to="info@team-sober.com", to=address, subject="S", body="B"
    )


class SecureSmtp:
    def __init__(self, login_error: Exception | None = None) -> None:
        self.login_error = login_error
        self.calls: list[str] = []
        self.credentials: tuple[str, str] | None = None
        self.messages: list[EmailMessage] = []

    def starttls(self, context: object = None) -> None:
        self.calls.append("starttls")

    def login(self, user: str, password: str) -> None:
        self.calls.append("login")
        if self.login_error:
            raise self.login_error
        self.credentials = (user, password)

    def send_message(self, message: EmailMessage) -> dict[str, tuple[int, bytes]]:
        self.calls.append("send")
        self.messages.append(message)
        return {}

    def quit(self) -> None:
        self.calls.append("quit")

    def close(self) -> None:
        self.calls.append("close")


def live_sender(fake: SecureSmtp) -> SmtpEmailSender:
    settings = SmtpSettings(
        host="smtp.gmail.com",
        port=587,
        timeout_seconds=1,
        mode=DeliveryMode.LIVE,
        sandbox_hosts=frozenset(),
        security=SmtpSecurity.STARTTLS,
        login=SmtpLogin(user=USER, password=SECRET),
    )
    return SmtpEmailSender(settings, lambda _host, _port, _timeout: cast("smtplib.SMTP", fake))


def test_live_sender_secures_logs_in_then_sends() -> None:
    fake = SecureSmtp()
    receipt = live_sender(fake).send(email_to("someone@gmail.com"))
    assert fake.calls == ["starttls", "login", "send", "quit"]
    assert fake.credentials == (USER, SECRET)
    assert fake.messages[0]["From"] == "CareerPilot <info@team-sober.com>"
    assert receipt.message_id.endswith("@team-sober.com>")


def test_rejected_login_is_permanent_and_sends_nothing() -> None:
    fake = SecureSmtp(login_error=smtplib.SMTPAuthenticationError(535, b"bad credentials"))
    with pytest.raises(DeliveryError) as error:
        live_sender(fake).send(email_to("someone@gmail.com"))
    assert (error.value.reason, error.value.retryable) == ("SMTPAuthenticationError", False)
    assert "send" not in fake.calls
    assert fake.calls[-1] == "quit"


def test_password_never_appears_in_settings_text() -> None:
    assert SECRET not in repr(SmtpLogin(user=USER, password=SECRET))


def test_routing_keeps_protected_domains_in_the_sandbox() -> None:
    live, sandbox = InMemoryEmailSender(), InMemoryEmailSender()
    router = RecipientRoutingSender(live, sandbox, frozenset({"sober.com", "Example.com"}))
    for address in ("admin@sober.com", "Tester@EXAMPLE.com", "person@gmail.com"):
        router.send(email_to(address))
    assert [e.to for e in sandbox.sent] == ["admin@sober.com", "Tester@EXAMPLE.com"]
    assert [e.to for e in live.sent] == ["person@gmail.com"]


def test_account_mail_stays_in_the_sandbox_without_credentials() -> None:
    sandbox = InMemoryEmailSender()
    assert account_sender_for(load_settings("local"), sandbox, {}) is sandbox
    assert account_sender_for(load_settings("local"), sandbox, {"CAREERPILOT_MAIL_USER": USER}) is sandbox


def test_account_mail_goes_through_the_configured_smtp_with_credentials(monkeypatch: pytest.MonkeyPatch) -> None:
    fake = SecureSmtp()
    opened: list[tuple[str, int]] = []

    def connect(host: str, port: int, _timeout: float) -> smtplib.SMTP:
        opened.append((host, port))
        return cast("smtplib.SMTP", fake)

    monkeypatch.setattr(bootstrap, "connect_smtp", connect)
    sandbox = InMemoryEmailSender()
    sender = account_sender_for(load_settings("local"), sandbox, CREDENTIALS)
    sender.send(email_to("person@gmail.com"))
    sender.send(email_to("admin@sober.com"))
    assert opened == [("smtp.gmail.com", 587)]
    assert fake.credentials == (USER, SECRET)
    assert [e.to for e in sandbox.sent] == ["admin@sober.com"]


class InlineRunner(Executor):
    def submit(self, fn: Callable[..., None], /, *args: object, **kwargs: object) -> Future[None]:
        future: Future[None] = Future()
        try:
            future.set_result(fn(*args, **kwargs))
        except Exception as error:
            future.set_exception(error)
        return future


class FlakySender:
    def __init__(self, *outcomes: Exception | None) -> None:
        self.outcomes = list(outcomes)
        self.attempts = 0

    def send(self, email: OutgoingEmail) -> SentReceipt:
        self.attempts += 1
        outcome = self.outcomes.pop(0) if self.outcomes else None
        if outcome is not None:
            raise outcome
        return SentReceipt(message_id="<sent@test>")


def courier(sender: FlakySender, pauses: list[float]) -> BackgroundCourier:
    return BackgroundCourier(sender, attempts=3, retry_delay_seconds=5, runner=InlineRunner(), sleep=pauses.append)


def test_background_courier_retries_network_hiccups_then_delivers() -> None:
    sender, pauses, failures = FlakySender(DeliveryError("gaierror", retryable=True), DeliveryError("timeout", retryable=True)), [], []
    courier(sender, pauses).deliver(email_to("person@gmail.com"), failures.append)
    assert (sender.attempts, pauses, failures) == (3, [5, 10], [])


def test_background_courier_gives_up_on_permanent_errors_and_reports_once() -> None:
    sender, pauses, failures = FlakySender(DeliveryError("SMTPAuthenticationError", retryable=False)), [], []
    courier(sender, pauses).deliver(email_to("person@gmail.com"), failures.append)
    assert (sender.attempts, pauses, [f.reason for f in failures]) == (1, [], ["SMTPAuthenticationError"])


def test_background_courier_reports_after_the_last_attempt() -> None:
    sender, pauses, failures = FlakySender(*[DeliveryError("timeout", retryable=True)] * 3), [], []
    courier(sender, pauses).deliver(email_to("person@gmail.com"), failures.append)
    assert (sender.attempts, len(failures)) == (3, 1)


def test_uncertain_delivery_is_not_withdrawn() -> None:
    sender, pauses, failures = FlakySender(DeliveryUncertainError("SMTPServerDisconnected")), [], []
    courier(sender, pauses).deliver(email_to("person@gmail.com"), failures.append)
    assert (sender.attempts, failures) == (1, [])


def test_background_courier_answers_without_waiting_for_delivery() -> None:
    started = threading.Event()
    release = threading.Event()

    class SlowSender:
        def send(self, email: OutgoingEmail) -> SentReceipt:
            started.set()
            release.wait(5)
            return SentReceipt(message_id="<slow@test>")

    with ThreadPoolExecutor(max_workers=1) as runner:
        BackgroundCourier(SlowSender(), attempts=1, retry_delay_seconds=0, runner=runner).deliver(
            email_to("person@gmail.com"), lambda _e: None
        )
        assert started.wait(5)
        release.set()


def test_direct_courier_reports_failures_inline() -> None:
    failures: list[DeliveryError] = []
    DirectCourier(FlakySender(DeliveryError("timeout", retryable=True))).deliver(email_to("person@gmail.com"), failures.append)
    assert len(failures) == 1


def test_link_emails_carry_a_readable_html_link_and_a_plain_text_fallback() -> None:
    url = "https://app.example.org/set-password?token=usr_1.secret"
    html = render_html("en", ["Hello <Rajib> & co,", EmailLink("Account creation link", url), ""])
    message = build_message(
        email_to("person@example.org").__class__(**{**email_to("person@example.org").__dict__, "body": f"Open {url}", "html": html})
    )
    assert message.get_content_type() == "multipart/alternative"
    plain = message.get_body(preferencelist=("plain",))
    rich = message.get_body(preferencelist=("html",))
    assert plain is not None and url in plain.get_content()
    assert rich is not None
    content = rich.get_content()
    assert f'<a href="{url}">Account creation link</a>' in content
    assert "Hello &lt;Rajib&gt; &amp; co," in content
    assert content.count("<p>") == 2
