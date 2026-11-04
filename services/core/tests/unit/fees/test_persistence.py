import pytest
from sqlalchemy import select

from careerpilot.fees.adapters.in_memory import InMemoryFeeRecords
from careerpilot.fees.adapters.sql import FeeRecordRow, SqlFeeRecords
from careerpilot.fees.enums import RecordKind
from careerpilot.fees.ports import FeeRecordRepository
from careerpilot.platform.clock import FixedClock
from careerpilot.platform.persistence import SQLITE_MEMORY_URL, Base, Database, create_database

OWNER = "user_a"


@pytest.fixture
def database(clock: FixedClock) -> Database:
    created = create_database(SQLITE_MEMORY_URL, clock)
    Base.metadata.create_all(created.engine)
    return created


def exercise(repository: FeeRecordRepository) -> None:
    repository.save(OWNER, RecordKind.PAYMENT, "p1", {"id": "p1", "amount": 1})
    repository.save(OWNER, RecordKind.PAYMENT, "p1", {"id": "p1", "amount": 2})
    repository.save(OWNER, RecordKind.RULE, "r1", {"id": "r1"})
    assert repository.get(OWNER, RecordKind.PAYMENT, "p1") == {"id": "p1", "amount": 2}
    assert repository.get("other", RecordKind.PAYMENT, "p1") is None
    assert len(repository.for_user(OWNER, RecordKind.PAYMENT)) == 1
    repository.remove(OWNER, RecordKind.PAYMENT, "p1", "removed")
    assert repository.for_user(OWNER, RecordKind.PAYMENT) == []
    assert len(repository.for_user(OWNER, RecordKind.RULE)) == 1


def test_in_memory_records_are_scoped() -> None:
    exercise(InMemoryFeeRecords())


def test_sql_records_are_audited_and_only_soft_deleted(database: Database, clock: FixedClock) -> None:
    exercise(SqlFeeRecords(database, clock))
    with database.unit_of_work() as session:
        rows = {row.id: row for row in session.scalars(select(FeeRecordRow))}
    assert rows["p1"].deleted_at is not None
    assert rows["p1"].delete_reason == "removed"
    assert rows["r1"].deleted_at is None
    assert rows["r1"].created_at is not None
