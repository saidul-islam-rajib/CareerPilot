import pytest
from sqlalchemy import select

from careerpilot.academic.adapters.in_memory import InMemoryAcademicRecords
from careerpilot.academic.adapters.sql import AcademicRecordRow, SqlAcademicRecords
from careerpilot.academic.enums import RecordKind
from careerpilot.academic.ports import AcademicRecordRepository
from careerpilot.platform.clock import FixedClock
from careerpilot.platform.persistence import SQLITE_MEMORY_URL, Base, Database, create_database
from tests.unit.conftest import DEMO_USER


@pytest.fixture
def database(clock: FixedClock) -> Database:
    created = create_database(SQLITE_MEMORY_URL, clock)
    Base.metadata.create_all(created.engine)
    return created


def exercise(repository: AcademicRecordRepository) -> None:
    repository.save(DEMO_USER, RecordKind.REFEREE, "r1", {"id": "r1", "name": "Dr A"})
    repository.save(DEMO_USER, RecordKind.REFEREE, "r1", {"id": "r1", "name": "Dr B"})
    repository.save(DEMO_USER, RecordKind.PROGRAM, "p1", {"id": "p1"})
    assert repository.get(DEMO_USER, RecordKind.REFEREE, "r1") == {"id": "r1", "name": "Dr B"}
    assert repository.get("someone_else", RecordKind.REFEREE, "r1") is None
    assert repository.get(DEMO_USER, RecordKind.PROGRAM, "r1") is None
    assert len(repository.for_user(DEMO_USER, RecordKind.REFEREE)) == 1
    repository.remove(DEMO_USER, RecordKind.REFEREE, "r1", "removed")
    assert repository.for_user(DEMO_USER, RecordKind.REFEREE) == []
    assert len(repository.for_user(DEMO_USER, RecordKind.PROGRAM)) == 1


def test_in_memory_records_are_scoped_by_user_and_kind() -> None:
    exercise(InMemoryAcademicRecords())


def test_sql_records_are_scoped_audited_and_only_soft_deleted(database: Database, clock: FixedClock) -> None:
    exercise(SqlAcademicRecords(database, clock))
    with database.unit_of_work() as session:
        rows = {row.id: row for row in session.scalars(select(AcademicRecordRow))}
        assert rows["r1"].deleted_at is not None
        assert rows["r1"].delete_reason == "removed"
        assert rows["p1"].deleted_at is None
        assert rows["p1"].created_by_type
        assert rows["p1"].version >= 1
