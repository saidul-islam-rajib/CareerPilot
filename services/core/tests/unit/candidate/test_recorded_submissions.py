from datetime import timedelta

import pytest

from careerpilot.bootstrap import Container
from careerpilot.platform.clock import FixedClock
from careerpilot.platform.enums import NotificationKind, NotificationTarget, SubmissionStatus, TimelineActor
from careerpilot.platform.errors import DomainError, ErrorCode
from tests.unit.candidate.test_submission import EMAIL_OPPORTUNITY, PORTAL_OPPORTUNITY, approve, record
from tests.unit.conftest import DEMO_USER


def kinds(container: Container) -> list[NotificationKind]:
    return [n.kind for n in container.notifications.recent(DEMO_USER)]


def test_sent_and_confirmed_applications_notify_the_user_in_the_app(service: Container, clock: FixedClock) -> None:
    application_id = approve(service, EMAIL_OPPORTUNITY)
    service.submissions.submit(DEMO_USER, application_id)
    [submitted] = service.notifications.recent(DEMO_USER)
    assert (submitted.kind, submitted.target, submitted.target_id) == (
        NotificationKind.APPLICATION_SUBMITTED,
        NotificationTarget.APPLICATION,
        application_id,
    )
    assert "Senior Frontend Engineer" in submitted.body
    service.submissions.submit(DEMO_USER, application_id)
    assert kinds(service) == [NotificationKind.APPLICATION_SUBMITTED]
    clock.advance(timedelta(hours=service.settings.submission.bounce_window_hours))
    service.submissions.confirm_sent()
    assert kinds(service) == [NotificationKind.APPLICATION_CONFIRMED, NotificationKind.APPLICATION_SUBMITTED]
    assert service.notifications.inbox(DEMO_USER).unread_notifications == 2


def test_people_record_portal_applications_they_finished_themselves(service: Container) -> None:
    application_id = approve(service, PORTAL_OPPORTUNITY)
    assert service.submissions.submit(DEMO_USER, application_id).status is SubmissionStatus.MANUAL_ACTION_REQUIRED
    assert kinds(service) == []
    recorded = service.applications.record_submitted(DEMO_USER, application_id)
    assert recorded.submission_status is SubmissionStatus.SUBMITTED_AWAITING_CONFIRMATION
    assert recorded.applied_at is not None
    assert recorded.timeline[-1].actor is TimelineActor.USER
    assert record(service, application_id).submission_status is SubmissionStatus.SUBMITTED_AWAITING_CONFIRMATION
    assert kinds(service) == [NotificationKind.APPLICATION_SUBMITTED]
    with pytest.raises(DomainError) as raised:
        service.applications.record_submitted(DEMO_USER, application_id)
    assert (raised.value.code, raised.value.detail) == (ErrorCode.VALIDATION, "application_not_manual")
