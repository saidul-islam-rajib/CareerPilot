import pytest

from careerpilot.administration.context import PageRequest
from careerpilot.bootstrap import Container
from careerpilot.platform.enums import ActorType
from careerpilot.platform.errors import DomainError, ErrorCode
from careerpilot.reports.enums import ReportAudit, ReportKind, ReportStatus
from careerpilot.reports.models import ReportInput
from tests.unit.administration.conftest import actor
from tests.unit.conftest import DEMO_USER

OPPORTUNITY = "opp_remote_frontend"
AUDIT_PAGE = 20


def test_a_report_is_stored_for_admins_and_audited(app: Container) -> None:
    report = app.opportunity_reports.submit(DEMO_USER, OPPORTUNITY, ReportInput(kind=ReportKind.DEAD_LINK, note="  404 page  "))
    assert report.status is ReportStatus.OPEN
    assert report.note == "404 page"
    assert report.opportunity_title
    assert app.opportunity_reports.mine(DEMO_USER) == [report]
    admin = actor(app)
    assert app.opportunity_reports.admin_list(admin, ReportStatus.OPEN) == [report]
    entries = app.admin_audit.list(admin, PageRequest(page_size=AUDIT_PAGE)).items
    submitted = next(e for e in entries if e.action == ReportAudit.SUBMITTED.value)
    assert (submitted.target, submitted.actor_type) == (report.id, ActorType.USER)


def test_an_admin_review_is_recorded_and_audited(app: Container) -> None:
    report = app.opportunity_reports.submit(DEMO_USER, OPPORTUNITY, ReportInput(kind=ReportKind.FALSE_MERGE))
    admin = actor(app)
    reviewed = app.opportunity_reports.set_status(admin, report.id, ReportStatus.ACTIONED)
    assert (reviewed.status, reviewed.reviewed_by) == (ReportStatus.ACTIONED, admin.summary.id)
    assert app.opportunity_reports.admin_list(admin, ReportStatus.OPEN) == []
    actions = [e.action for e in app.admin_audit.list(admin, PageRequest(page_size=AUDIT_PAGE)).items]
    assert f"{ReportAudit.STATUS_CHANGED.value}.{ReportStatus.ACTIONED.value}" in actions


def test_the_same_open_report_cannot_be_filed_twice_and_unknown_jobs_are_refused(app: Container) -> None:
    data = ReportInput(kind=ReportKind.FRAUD)
    app.opportunity_reports.submit(DEMO_USER, OPPORTUNITY, data)
    with pytest.raises(DomainError) as twice:
        app.opportunity_reports.submit(DEMO_USER, OPPORTUNITY, data)
    assert twice.value.code is ErrorCode.CONFLICT
    with pytest.raises(DomainError) as missing:
        app.opportunity_reports.submit(DEMO_USER, "opp_none", data)
    assert missing.value.code is ErrorCode.NOT_FOUND
