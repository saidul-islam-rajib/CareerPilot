import pytest
from fastapi.testclient import TestClient

from careerpilot.administration.context import AdminActor, PageRequest
from careerpilot.administration.user_records import AdminApplicationChange, AdminProfileChange
from careerpilot.api.admin_app import create_admin_app
from careerpilot.bootstrap import Container
from careerpilot.platform.enums import (
    ApplicationFilter,
    ApplicationMode,
    ApprovalState,
    OpportunityDecision,
    OutcomeStatus,
    SubmissionStatus,
    TimelineActor,
)
from careerpilot.platform.errors import DomainError, ErrorCode
from tests.unit.conftest import CLIENT, DEMO_USER

PASSWORD = "admin@sober.com"
ALL = PageRequest(page_size=500)


def admin(container: Container, email: str = "admin@sober.com") -> AdminActor:
    return container.admin_auth.authenticate(container.admin_auth.sign_in(email, PASSWORD, CLIENT.ip).access_token)


def first_application_id(container: Container) -> str:
    return container.applications.list(DEMO_USER, ApplicationFilter.ALL)[0].id


def test_real_accounts_are_listed_for_admins_with_live_numbers(container: Container) -> None:
    rows = container.admin_users.list(admin(container), ALL).items
    demo = [row for row in rows if row.id == DEMO_USER]
    assert len(demo) == 1
    assert demo[0].applications_count == len(container.recommendations._ctx.workspaces.get(DEMO_USER).applications)  # pyright: ignore[reportPrivateUsage]


def test_admins_see_every_detail_of_a_user(container: Container) -> None:
    record = container.user_records.record(admin(container), DEMO_USER)
    assert record.user.id == DEMO_USER
    assert record.profile.full_name
    assert record.lists and record.lists[0].track.kind == "bangladesh_onsite"
    assert record.applications and record.approvals
    assert record.applications[0].timeline
    assert any(job.applied for listed in record.lists for job in listed.jobs) or record.applications


def test_admins_change_an_application_and_the_user_sees_why(container: Container) -> None:
    application_id = first_application_id(container)
    change = AdminApplicationChange(outcome_status=OutcomeStatus.WITHDRAWN, note="Withdrawn at the user's request by phone")
    record = container.user_records.change_application(admin(container), DEMO_USER, application_id, change)
    changed = next(a for a in record.applications if a.id == application_id)
    assert changed.outcome_status is OutcomeStatus.WITHDRAWN
    assert changed.timeline[-1].actor is TimelineActor.ADMIN
    assert "Withdrawn at the user's request by phone" in changed.timeline[-1].text
    assert container.applications.get(DEMO_USER, application_id).outcome_status is OutcomeStatus.WITHDRAWN


def test_archived_applications_leave_the_user_lists_and_can_be_restored(container: Container) -> None:
    application_id = first_application_id(container)
    container.user_records.archive_application(admin(container), DEMO_USER, application_id, archived=True)
    assert application_id not in {a.id for a in container.applications.list(DEMO_USER, ApplicationFilter.ALL)}
    archived = next(a for a in container.user_records.record(admin(container), DEMO_USER).applications if a.id == application_id)
    assert archived.archived_at is not None
    container.user_records.archive_application(admin(container), DEMO_USER, application_id, archived=False)
    assert application_id in {a.id for a in container.applications.list(DEMO_USER, ApplicationFilter.ALL)}


def test_admins_remove_a_job_from_a_users_lists_and_change_tracks(container: Container) -> None:
    shown = next(o for digest in container.dashboard.get(DEMO_USER).tracks for o in digest.opportunities)
    container.user_records.set_job_decision(admin(container), DEMO_USER, shown.id, OpportunityDecision.DISMISSED)
    assert shown.id not in {o.id for digest in container.dashboard.get(DEMO_USER).tracks for o in digest.opportunities}
    container.user_records.set_job_decision(admin(container), DEMO_USER, shown.id, None)
    record = container.user_records.update_track(admin(container), DEMO_USER, "trk_remote", 7, ApplicationMode.AUTOMATIC)
    remote = next(t for t in record.preferences.tracks if t.id == "trk_remote")
    assert (remote.result_count, remote.mode) == (7, ApplicationMode.AUTOMATIC)


def test_admins_edit_the_profile_and_reject_pending_approvals(container: Container) -> None:
    record = container.user_records.update_profile(
        admin(container), DEMO_USER, AdminProfileChange(headline="Frontend engineer", country_code="sg")
    )
    assert (record.profile.headline, record.profile.country_code) == ("Frontend engineer", "SG")
    pending = next(a for a in record.approvals if a.state is ApprovalState.PENDING)
    rejected = container.user_records.reject_approval(admin(container), DEMO_USER, pending.id)
    assert next(a for a in rejected.approvals if a.id == pending.id).state is ApprovalState.REJECTED


def test_cancelling_from_the_applications_page_changes_the_real_application(container: Container) -> None:
    queued = next(
        a
        for a in container.recommendations._ctx.workspaces.get(DEMO_USER).applications
        if a.submission_status is SubmissionStatus.APPROVED_QUEUED
    )  # pyright: ignore[reportPrivateUsage]
    row = container.admin_catalog.cancel_application(admin(container), queued.id)
    assert row.submission_status is SubmissionStatus.CANCELLED
    assert container.applications.get(DEMO_USER, queued.id).submission_status is SubmissionStatus.CANCELLED


def test_read_only_admins_cannot_change_user_data(container: Container) -> None:
    viewer = admin(container, "viewer@sober.com")
    assert container.user_records.record(viewer, DEMO_USER).user.id == DEMO_USER
    with pytest.raises(DomainError) as raised:
        container.user_records.change_application(viewer, DEMO_USER, first_application_id(container), AdminApplicationChange(note="x"))
    assert raised.value.code is ErrorCode.FORBIDDEN


def test_user_record_endpoints(container: Container) -> None:
    client = TestClient(create_admin_app(container))
    token = client.post("/admin/v1/auth/sign-in", json={"email": "admin@sober.com", "password": PASSWORD}).json()["accessToken"]
    headers = {"Authorization": f"Bearer {token}"}
    record = client.get(f"/admin/v1/users/{DEMO_USER}/record", headers=headers)
    assert record.status_code == 200
    application_id = record.json()["applications"][0]["id"]
    changed = client.patch(
        f"/admin/v1/users/{DEMO_USER}/applications/{application_id}", headers=headers, json={"outcomeStatus": "rejected"}
    )
    assert changed.status_code == 200
    assert client.post(f"/admin/v1/users/{DEMO_USER}/resume-automation", headers=headers).status_code == 200
