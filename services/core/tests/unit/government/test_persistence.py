from datetime import date

import pytest
from sqlalchemy import select

from careerpilot.government.adapters.sql import (
    CircularRow,
    GovApplicationRow,
    HolidayRow,
    SqlCircularRepository,
    SqlGovApplicationRepository,
    SqlHolidayRepository,
)
from careerpilot.government.models import Circular, GovApplication, Holiday, Post
from careerpilot.platform.clock import FixedClock
from careerpilot.platform.enums import CircularStatus, SecretKind
from careerpilot.platform.persistence import SQLITE_MEMORY_URL, Base, Database, create_database
from tests.unit.conftest import DEMO_USER


@pytest.fixture
def database(clock: FixedClock) -> Database:
    created = create_database(SQLITE_MEMORY_URL, clock)
    Base.metadata.create_all(created.engine)
    return created


def test_circulars_round_trip_and_are_only_soft_deleted(database: Database, clock: FixedClock) -> None:
    repository = SqlCircularRepository(database, clock)
    circular = Circular(
        id="circ_1",
        authority="Ministry",
        title="Recruitment",
        status=CircularStatus.PUBLISHED,
        closes_on=date(2026, 11, 12),
        posts=[Post(id="p1", title="Officer", grade=9)],
    )
    repository.save(circular)
    stored = repository.get("circ_1")
    assert stored is not None
    assert stored.closes_on == date(2026, 11, 12)
    assert stored.posts[0].grade == 9
    repository.remove("circ_1", "test")
    assert repository.get("circ_1") is None
    with database.unit_of_work() as session:
        row = session.scalars(select(CircularRow)).one()
        assert row.deleted_at is not None
        assert row.delete_reason == "test"
        assert row.created_at is not None


def test_holidays_and_applications_are_stored_with_audit_columns(database: Database, clock: FixedClock) -> None:
    holidays = SqlHolidayRepository(database, clock)
    holidays.add(Holiday(id="hol_1", on=date(2026, 11, 12), name="Special holiday"))
    assert [h.name for h in holidays.between(date(2026, 11, 1), date(2026, 11, 30))] == ["Special holiday"]
    assert holidays.between(date(2026, 12, 1), date(2026, 12, 31)) == []
    applications = SqlGovApplicationRepository(database, clock)
    application = GovApplication(
        id="gap_1",
        user_id=DEMO_USER,
        circular_id="circ_1",
        circular_version=1,
        post_ids=["p1"],
        sealed={SecretKind.PASSWORD: "sealed-text"},
        created_at="2026-10-20T06:00:00Z",
    )
    applications.save(application)
    found = applications.get(DEMO_USER, "gap_1")
    assert found is not None
    assert found.sealed == {SecretKind.PASSWORD: "sealed-text"}
    assert applications.get("someone_else", "gap_1") is None
    applications.remove(DEMO_USER, "gap_1", "withdrawn")
    assert applications.for_user(DEMO_USER) == []
    with database.unit_of_work() as session:
        assert session.scalars(select(GovApplicationRow)).one().deleted_at is not None
        assert session.scalars(select(HolidayRow)).one().created_by_type
