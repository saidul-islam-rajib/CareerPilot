from datetime import timedelta

from careerpilot.bootstrap import Container
from careerpilot.candidate.models import ApplicationRecord
from careerpilot.integrations.fake_google import FakeGoogleGateway
from careerpilot.platform.clock import FixedClock
from careerpilot.platform.enums import (
    ConnectionStatus,
    IntegrationProvider,
    NotificationKind,
    OutcomeStatus,
    ReplyDisposition,
    SubmissionStatus,
    SyncFailure,
    TaskKind,
    TimelineActor,
)
from tests.unit.conftest import DEMO_USER
from tests.unit.integrations.conftest import EMPLOYER, connect, mail

KITE_SENDER = "talent@kitecommerce-mail.example.net"
KITE_NAME = "Kite Commerce Talent"


def application(container: Container, application_id: str) -> ApplicationRecord:
    return next(a for a in container.applications._ctx.workspaces.get(DEMO_USER).applications if a.id == application_id)  # pyright: ignore[reportPrivateUsage]


def prepare_kite(container: Container, status: SubmissionStatus = SubmissionStatus.SUBMITTED_AWAITING_CONFIRMATION) -> None:
    workspaces = container.applications._ctx.workspaces  # pyright: ignore[reportPrivateUsage]
    workspace = workspaces.get(DEMO_USER)
    kite = next(a for a in workspace.applications if a.id == "app_kite")
    kite.submission_status = status
    kite.outcome_status = OutcomeStatus.NO_RESPONSE_YET
    workspaces.save(DEMO_USER, workspace)


def notification_kinds(container: Container) -> list[NotificationKind]:
    return [n.kind for n in container.notifications.recent(DEMO_USER)]


def test_an_interview_invitation_updates_the_application_and_creates_the_interview(google: Container, gateway: FakeGoogleGateway) -> None:
    prepare_kite(google)
    connect(google)
    gateway.messages["m1"] = mail(
        "m1", KITE_SENDER, "Interview invitation: Full-Stack Developer", "Please join us on 25 October 2026 at 14:30.", name=KITE_NAME
    )
    result = google.integrations.sync.sync_user(DEMO_USER)
    kite = application(google, "app_kite")
    assert (result.messages, result.events) == (1, 2)
    assert kite.outcome_status is OutcomeStatus.INTERVIEW
    assert kite.submission_status is SubmissionStatus.SUBMITTED_AWAITING_CONFIRMATION
    reply = kite.timeline[-1]
    assert reply.actor is TimelineActor.EMPLOYER
    assert reply.link == "https://mail.google.com/mail/u/0/#all/m1"
    assert "Kite Commerce Talent" in reply.text and "Interview invitation" in reply.text
    [task] = [t for t in kite.tasks if t.kind is TaskKind.INTERVIEW]
    assert task.due_at == "2026-10-25T08:30:00.000Z"
    assert NotificationKind.APPLICATION_REPLY in notification_kinds(google)


def test_a_reply_from_the_employer_confirms_an_application_awaiting_confirmation(google: Container, gateway: FakeGoogleGateway) -> None:
    workspaces = google.applications._ctx.workspaces  # pyright: ignore[reportPrivateUsage]
    workspace = workspaces.get(DEMO_USER)
    bay = next(a for a in workspace.applications if a.id == "app_bay")
    bay.submission_status = SubmissionStatus.SUBMITTED_AWAITING_CONFIRMATION
    workspaces.save(DEMO_USER, workspace)
    connect(google)
    gateway.messages["m9"] = mail("m9", "hr@baydigital.example.com", "Re: Software Engineer", "We have received your application.")
    google.integrations.sync.sync_user(DEMO_USER)
    bay = application(google, "app_bay")
    assert bay.submission_status is SubmissionStatus.CONFIRMED
    assert bay.timeline[-1].status is SubmissionStatus.CONFIRMED and bay.evidence
    assert NotificationKind.APPLICATION_CONFIRMED in notification_kinds(google)


def test_the_same_message_is_never_recorded_twice(google: Container, gateway: FakeGoogleGateway) -> None:
    prepare_kite(google, SubmissionStatus.CONFIRMED)
    connect(google)
    gateway.messages["m1"] = mail("m1", KITE_SENDER, "Thank you for applying", "We have received your application.", name=KITE_NAME)
    first = google.integrations.sync.sync_user(DEMO_USER)
    second = google.integrations.sync.sync_user(DEMO_USER)
    kite = application(google, "app_kite")
    assert (first.messages, second.messages) == (1, 0)
    assert gateway.reads == ["m1"]
    assert len([e for e in kite.timeline if e.actor is TimelineActor.EMPLOYER]) == 1
    assert kite.outcome_status is OutcomeStatus.UNDER_REVIEW
    assert notification_kinds(google).count(NotificationKind.APPLICATION_REPLY) == 1


def test_a_rejection_is_only_suggested_and_never_sets_the_outcome(google: Container, gateway: FakeGoogleGateway) -> None:
    connect(google)
    gateway.messages["m2"] = mail(
        "m2", EMPLOYER, "Your application", "Unfortunately we regret to inform you that we will not be moving forward."
    )
    google.integrations.sync.sync_user(DEMO_USER)
    bay = application(google, "app_bay")
    assert bay.outcome_status is OutcomeStatus.INTERVIEW
    assert "update the outcome yourself" in bay.timeline[-1].text
    stored = google.integrations.sync._ctx.synced.for_application(DEMO_USER, "app_bay")  # pyright: ignore[reportPrivateUsage]
    assert [(m.disposition, m.kind.value) for m in stored] == [(ReplyDisposition.SUGGESTED, "rejection")]
    titles = [n.title for n in google.notifications.recent(DEMO_USER)]
    assert "Possible Rejection from Bay Digital Ltd" in titles


def test_an_offer_is_only_suggested(google: Container, gateway: FakeGoogleGateway) -> None:
    connect(google)
    gateway.messages["m3"] = mail("m3", EMPLOYER, "Job offer", "We are pleased to offer you the position. See the offer letter.")
    google.integrations.sync.sync_user(DEMO_USER)
    assert application(google, "app_bay").outcome_status is OutcomeStatus.INTERVIEW


def test_a_reply_never_moves_the_outcome_backward(google: Container, gateway: FakeGoogleGateway) -> None:
    connect(google)
    gateway.messages["m4"] = mail("m4", EMPLOYER, "Thank you for applying", "We have received your application.")
    google.integrations.sync.sync_user(DEMO_USER)
    bay = application(google, "app_bay")
    assert bay.outcome_status is OutcomeStatus.INTERVIEW
    stored = google.integrations.sync._ctx.synced.for_application(DEMO_USER, "app_bay")  # pyright: ignore[reportPrivateUsage]
    assert stored[0].disposition is ReplyDisposition.RECORDED


def test_a_weak_signal_is_recorded_without_changing_the_outcome(google: Container, gateway: FakeGoogleGateway) -> None:
    prepare_kite(google, SubmissionStatus.CONFIRMED)
    connect(google)
    gateway.messages["m5"] = mail("m5", KITE_SENDER, "Application update", "Join our zoom call about the role.", name=KITE_NAME)
    google.integrations.sync.sync_user(DEMO_USER)
    assert application(google, "app_kite").outcome_status is OutcomeStatus.NO_RESPONSE_YET


def test_senders_that_match_nothing_are_ignored(google: Container, gateway: FakeGoogleGateway) -> None:
    connect(google)
    gateway.messages["m6"] = mail("m6", "friend@example.org", "Interview invitation", "Dinner?")
    gateway.messages["m7"] = mail("m7", "spam@kitecommerce-mail.example.net", "Weekly deals", "Buy now", name="Kite Commerce")
    assert google.integrations.sync.sync_user(DEMO_USER).messages == 0


def test_a_message_matching_two_applications_equally_is_skipped(google: Container, gateway: FakeGoogleGateway) -> None:
    workspaces = google.applications._ctx.workspaces  # pyright: ignore[reportPrivateUsage]
    workspace = workspaces.get(DEMO_USER)
    kite = next(a for a in workspace.applications if a.id == "app_kite")
    kite.emails = application(google, "app_bay").emails
    workspaces.save(DEMO_USER, workspace)
    connect(google)
    gateway.messages["m8"] = mail("m8", EMPLOYER, "Interview invitation", "Interview invitation")
    assert google.integrations.sync.sync_user(DEMO_USER).messages == 0


def test_free_mail_domains_match_only_the_exact_address(google: Container, gateway: FakeGoogleGateway) -> None:
    workspaces = google.applications._ctx.workspaces  # pyright: ignore[reportPrivateUsage]
    workspace = workspaces.get(DEMO_USER)
    bay = next(a for a in workspace.applications if a.id == "app_bay")
    bay.emails = [bay.emails[0].model_copy(update={"to": "hr.person@gmail.com"})]
    workspaces.save(DEMO_USER, workspace)
    connect(google)
    gateway.messages["a"] = mail("a", "someone.else@gmail.com", "Interview invitation", "Interview invitation")
    gateway.messages["b"] = mail("b", "hr.person@gmail.com", "Interview invitation", "Interview invitation")
    google.integrations.sync.sync_user(DEMO_USER)
    assert [m.message_id for m in google.integrations.sync._ctx.synced.for_application(DEMO_USER, "app_bay")] == ["b"]  # pyright: ignore[reportPrivateUsage]


def test_the_query_only_asks_for_employer_senders_and_keywords(google: Container, gateway: FakeGoogleGateway, clock: FixedClock) -> None:
    connect(google)
    google.integrations.sync.sync_user(DEMO_USER)
    [query] = gateway.queries
    assert f"from:{EMPLOYER}" in query and "from:baydigital.example.com" in query
    assert "subject:(" in query and "-from:me" in query
    assert query.startswith(f"after:{int((clock.now() - timedelta(days=14)).timestamp())} ")


def test_an_expired_access_token_is_refreshed_and_stored(google: Container, gateway: FakeGoogleGateway, clock: FixedClock) -> None:
    connect(google)
    before = google.integrations.google._ctx.connections.active(DEMO_USER, IntegrationProvider.GOOGLE)  # pyright: ignore[reportPrivateUsage]
    assert before is not None
    clock.advance(timedelta(hours=2))
    google.integrations.sync.sync_user(DEMO_USER)
    after = google.integrations.google._ctx.connections.active(DEMO_USER, IntegrationProvider.GOOGLE)  # pyright: ignore[reportPrivateUsage]
    assert after is not None
    assert gateway.refreshes == 1
    assert after.sealed_tokens != before.sealed_tokens
    assert after.last_sync_at is not None and after.last_error is None


def test_revoked_access_asks_to_reconnect_once(google: Container, gateway: FakeGoogleGateway, clock: FixedClock) -> None:
    connect(google)
    clock.advance(timedelta(hours=2))
    gateway.refresh_failure = SyncFailure.TOKEN_REVOKED
    google.integrations.sync.sync_user(DEMO_USER)
    google.integrations.sync.sync_user(DEMO_USER)
    status = google.integrations.google.status(DEMO_USER)
    assert not status.connected and status.connection is not None
    assert (status.connection.status, status.connection.last_error) == (ConnectionStatus.NEEDS_RECONNECT, SyncFailure.TOKEN_REVOKED)
    assert notification_kinds(google).count(NotificationKind.INTEGRATION_ATTENTION) == 1
    assert gateway.refreshes == 1


def test_a_google_outage_keeps_the_connection_and_records_the_error(google: Container, gateway: FakeGoogleGateway) -> None:
    connect(google)
    gateway.mail_failure = SyncFailure.GOOGLE_UNAVAILABLE
    google.integrations.sync.sync_user(DEMO_USER)
    status = google.integrations.google.status(DEMO_USER)
    assert status.connected and status.connection is not None
    assert status.connection.last_error is SyncFailure.GOOGLE_UNAVAILABLE
    assert NotificationKind.INTEGRATION_ATTENTION not in notification_kinds(google)


def test_without_mail_access_nothing_is_read_and_the_reason_is_shown(google: Container, gateway: FakeGoogleGateway) -> None:
    gateway.scopes = [s for s in gateway.scopes if "gmail" not in s]
    connect(google)
    google.integrations.sync.sync_user(DEMO_USER)
    assert gateway.queries == []
    status = google.integrations.google.status(DEMO_USER)
    assert status.mail_access is False
    assert status.connection is not None and status.connection.last_error is SyncFailure.MISSING_MAIL_ACCESS


def test_sync_all_continues_after_a_failure_and_skips_users_who_need_reconnecting(google: Container, gateway: FakeGoogleGateway) -> None:
    connect(google)
    assert google.integrations.sync.sync_all().events == 1
    repo = google.integrations.google._ctx.connections  # pyright: ignore[reportPrivateUsage]
    record = repo.active(DEMO_USER, IntegrationProvider.GOOGLE)
    assert record is not None
    repo.save(record.model_copy(update={"status": ConnectionStatus.NEEDS_RECONNECT}))
    assert google.integrations.sync.sync_all().events == 0
