from careerpilot.bootstrap import Container
from careerpilot.candidate.models import ApplicationRecord
from careerpilot.integrations.fake_google import FakeGoogleGateway
from careerpilot.platform.enums import NotificationKind, SubmissionStatus
from tests.unit.conftest import DEMO_USER
from tests.unit.integrations.conftest import connect, mail

DAEMON = "mailer-daemon@googlemail.com"
DSN_SUBJECT = "Delivery Status Notification (Failure)"


def stored(container: Container, application_id: str) -> ApplicationRecord:
    workspace = container.applications._ctx.workspaces.get(DEMO_USER)  # pyright: ignore[reportPrivateUsage]
    return next(a for a in workspace.applications if a.id == application_id)


def set_status(container: Container, application_id: str, status: SubmissionStatus) -> str:
    workspaces = container.applications._ctx.workspaces  # pyright: ignore[reportPrivateUsage]
    workspace = workspaces.get(DEMO_USER)
    target = next(a for a in workspace.applications if a.id == application_id)
    target.submission_status = status
    workspaces.save(DEMO_USER, workspace)
    return target.emails[0].to


def dsn_body(address: str) -> str:
    return f"Your message wasn't delivered to {address} because the address couldn't be found.\n550 5.1.1 User unknown"


def test_a_late_bounce_moves_a_confirmed_application_to_failed_and_notifies(google: Container, gateway: FakeGoogleGateway) -> None:
    address = set_status(google, "app_bay", SubmissionStatus.CONFIRMED)
    connect(google)
    gateway.messages["d1"] = mail("d1", DAEMON, DSN_SUBJECT, dsn_body(address))
    google.integrations.sync.sync_user(DEMO_USER)
    bay = stored(google, "app_bay")
    assert bay.submission_status is SubmissionStatus.FAILED
    assert bay.timeline[-1].status is SubmissionStatus.FAILED
    assert address in bay.timeline[-1].text
    assert NotificationKind.APPLICATION_BOUNCED in [n.kind for n in google.notifications.recent(DEMO_USER)]


def test_a_bounce_is_processed_once_and_nothing_is_resent(google: Container, gateway: FakeGoogleGateway) -> None:
    address = set_status(google, "app_bay", SubmissionStatus.CONFIRMED)
    connect(google)
    gateway.messages["d1"] = mail("d1", DAEMON, DSN_SUBJECT, dsn_body(address))
    google.integrations.sync.sync_user(DEMO_USER)
    count = len(stored(google, "app_bay").timeline)
    google.integrations.sync.sync_user(DEMO_USER)
    assert len(stored(google, "app_bay").timeline) == count
    assert gateway.sent == []


def test_a_bounce_for_an_unknown_address_changes_nothing(google: Container, gateway: FakeGoogleGateway) -> None:
    set_status(google, "app_bay", SubmissionStatus.CONFIRMED)
    connect(google)
    gateway.messages["d1"] = mail("d1", DAEMON, DSN_SUBJECT, dsn_body("someone.else@example.net"))
    google.integrations.sync.sync_user(DEMO_USER)
    assert stored(google, "app_bay").submission_status is SubmissionStatus.CONFIRMED


def test_a_bounce_does_not_touch_an_application_that_is_not_submitted(google: Container, gateway: FakeGoogleGateway) -> None:
    address = set_status(google, "app_bay", SubmissionStatus.CANCELLED)
    connect(google)
    gateway.messages["d1"] = mail("d1", DAEMON, DSN_SUBJECT, dsn_body(address))
    google.integrations.sync.sync_user(DEMO_USER)
    assert stored(google, "app_bay").submission_status is SubmissionStatus.CANCELLED


def test_an_ordinary_reply_is_not_mistaken_for_a_bounce(google: Container, gateway: FakeGoogleGateway) -> None:
    address = set_status(google, "app_bay", SubmissionStatus.CONFIRMED)
    connect(google)
    gateway.messages["r1"] = mail("r1", address, "Interview invitation", "We would like to meet you.")
    google.integrations.sync.sync_user(DEMO_USER)
    assert stored(google, "app_bay").submission_status is SubmissionStatus.CONFIRMED
