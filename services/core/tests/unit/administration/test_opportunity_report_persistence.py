import pytest
from sqlalchemy import select

from careerpilot.platform.clock import FixedClock
from careerpilot.platform.persistence import SQLITE_MEMORY_URL, Base, Database, create_database
from careerpilot.reports.adapters.in_memory import InMemoryReports
from careerpilot.reports.adapters.sql import OpportunityReportRow, SqlReports
from careerpilot.reports.enums import ReportKind, ReportStatus
from careerpilot.reports.models import OpportunityReport
from careerpilot.reports.ports import ReportRepository

OWNER = "user_a"


@pytest.fixture
def database(clock: FixedClock) -> Database:
    created = create_database(SQLITE_MEMORY_URL, clock)
    Base.metadata.create_all(created.engine)
    return created


def report(report_id: str, user_id: str = OWNER) -> OpportunityReport:
    return OpportunityReport(
        id=report_id,
        user_id=user_id,
        opportunity_id="opp_1",
        opportunity_title="Role",
        kind=ReportKind.DEAD_LINK,
        note="",
        status=ReportStatus.OPEN,
        created_at=f"2026-11-19T00:00:0{report_id[-1]}Z",
    )


def exercise(repository: ReportRepository) -> None:
    repository.add(report("rpt_1"))
    repository.add(report("rpt_2", "user_b"))
    assert [r.id for r in repository.for_user(OWNER)] == ["rpt_1"]
    repository.save(report("rpt_1").model_copy(update={"status": ReportStatus.DISMISSED}))
    assert [r.id for r in repository.with_status(ReportStatus.OPEN)] == ["rpt_2"]
    assert {r.id for r in repository.with_status(None)} == {"rpt_2", "rpt_1"}
    found = repository.get("rpt_1")
    assert found is not None
    assert found.status is ReportStatus.DISMISSED
    assert repository.get("rpt_none") is None


def test_in_memory_reports_behave_like_the_port() -> None:
    exercise(InMemoryReports())


def test_sql_reports_are_audited_rows(database: Database) -> None:
    exercise(SqlReports(database))
    with database.unit_of_work() as session:
        rows = list(session.scalars(select(OpportunityReportRow)))
    assert len(rows) == 2
    assert all(row.created_at and row.updated_at and row.deleted_at is None for row in rows)
