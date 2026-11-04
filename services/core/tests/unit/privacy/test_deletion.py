from datetime import timedelta

import pytest

from careerpilot.bootstrap import Container
from careerpilot.candidate.services.auth import Registration
from careerpilot.integrations.fake_google import FakeGoogleGateway
from careerpilot.platform.clock import FixedClock
from careerpilot.platform.email_delivery import InMemoryEmailSender
from careerpilot.platform.enums import UserAccountStatus
from careerpilot.platform.errors import DomainError, ErrorCode
from careerpilot.privacy.enums import DeletionScope, DeletionStatus, ExportFormat, ExportKind
from careerpilot.privacy.exports import ExportSpec
from tests.unit.conftest import CLIENT, DEMO_USER, STRONG_PASSWORD, register_and_activate
from tests.unit.integrations.conftest import connect
from tests.unit.privacy.conftest import OWNER_PASSWORD, RepositoryTap

GRACE = timedelta(days=14)


def status_of(tap: RepositoryTap) -> UserAccountStatus:
    account = tap.repos.accounts.get(DEMO_USER)
    assert account is not None
    return account.status


def test_the_plan_lists_what_is_erased_kept_and_out_of_reach(container: Container) -> None:
    plan = container.privacy.deletion.view(DEMO_USER).plan
    assert plan.grace_days == 14
    assert DeletionScope.APPLICATIONS in plan.erased
    assert plan.retained
    assert all(item.reason and item.retention_days > 0 for item in plan.retained)
    assert plan.external


def test_request_needs_the_password(container: Container) -> None:
    with pytest.raises(DomainError) as error:
        container.privacy.deletion.request(DEMO_USER, "wrong")
    assert error.value.code is ErrorCode.INVALID_CREDENTIALS
    assert container.privacy.deletion.view(DEMO_USER).status is None


def test_request_stops_automation_revokes_google_and_schedules(container: Container, gateway: FakeGoogleGateway, clock: FixedClock) -> None:
    connect(container)
    view = container.privacy.deletion.request(DEMO_USER, OWNER_PASSWORD)
    assert view.status is DeletionStatus.REQUESTED
    assert view.scheduled_for is not None
    assert view.scheduled_for.startswith("2026-11-03")
    assert DEMO_USER not in container.digests.due_users()
    assert DEMO_USER not in [item.user_id for item in container.submissions.due()]
    assert len(gateway.revoked) == 1
    assert container.integrations.google.status(DEMO_USER).connected is False
    again = container.privacy.deletion.request(DEMO_USER, OWNER_PASSWORD)
    assert again.scheduled_for == view.scheduled_for


def test_the_user_can_still_sign_in_and_cancel_during_the_grace_period(container: Container, tap: RepositoryTap) -> None:
    container.privacy.deletion.request(DEMO_USER, OWNER_PASSWORD)
    container.auth.sign_in("admin@sober.com", OWNER_PASSWORD, CLIENT)
    view = container.privacy.deletion.cancel(DEMO_USER)
    assert view.status is None
    assert status_of(tap) is UserAccountStatus.ACTIVE
    with pytest.raises(DomainError) as error:
        container.privacy.deletion.cancel(DEMO_USER)
    assert error.value.code is ErrorCode.CONFLICT


def test_nothing_is_anonymized_before_the_grace_period_ends(container: Container, clock: FixedClock, tap: RepositoryTap) -> None:
    container.privacy.deletion.request(DEMO_USER, OWNER_PASSWORD)
    clock.advance(GRACE - timedelta(minutes=1))
    assert container.privacy.deletion.process_due() == 0
    assert status_of(tap) is UserAccountStatus.PENDING_DELETION


def test_a_cancelled_request_is_never_anonymized(container: Container, clock: FixedClock) -> None:
    container.privacy.deletion.request(DEMO_USER, OWNER_PASSWORD)
    container.privacy.deletion.cancel(DEMO_USER)
    clock.advance(GRACE * 2)
    assert container.privacy.deletion.process_due() == 0


def test_anonymization_erases_personal_data_and_keeps_a_minimal_record(
    container: Container, clock: FixedClock, outbox: InMemoryEmailSender, tap: RepositoryTap
) -> None:
    container.privacy.exports.request(DEMO_USER, ExportSpec(ExportKind.APPLICATIONS, ExportFormat.CSV))
    container.privacy.deletion.request(DEMO_USER, OWNER_PASSWORD)
    outbox.sent.clear()
    clock.advance(GRACE + timedelta(minutes=1))
    assert container.privacy.deletion.process_due() == 1
    assert [email.to for email in outbox.sent] == ["admin@sober.com"]
    account = tap.repos.accounts.get(DEMO_USER)
    assert account is not None
    assert account.status is UserAccountStatus.DELETED
    assert account.user.full_name == "Deleted user"
    assert account.user.email.endswith("@deleted.invalid")
    assert "admin@sober.com" not in account.user.email
    workspace = tap.repos.workspaces.get(DEMO_USER)
    assert workspace.applications == []
    assert workspace.profile.full_name == ""
    assert workspace.sign_in_events == []
    assert container.privacy.exports.history(DEMO_USER, "")[0].status.value == "expired"
    with pytest.raises(DomainError):
        container.auth.sign_in("admin@sober.com", OWNER_PASSWORD, CLIENT)
    assert container.privacy.deletion.process_due() == 0
    assert len(outbox.sent) == 1


def test_a_registered_user_can_delete_and_the_address_is_freed(
    empty_container: Container, outbox: InMemoryEmailSender, clock: FixedClock
) -> None:
    registration = Registration("Nadia Rahman", "nadia@sober.com", True, "1.0", "1.0")
    session = register_and_activate(empty_container, outbox, registration)
    empty_container.privacy.deletion.request(session.user.id, STRONG_PASSWORD)
    clock.advance(GRACE + timedelta(minutes=1))
    assert empty_container.privacy.deletion.process_due() == 1
    again = register_and_activate(empty_container, outbox, registration)
    assert again.user.id != session.user.id
