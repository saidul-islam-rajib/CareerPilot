import pytest
from sqlalchemy import func, select

from careerpilot.bootstrap import Container, ContainerOverrides, build_container
from careerpilot.integrations.adapters.sql import CalendarEventRow, ConnectionRow, SyncedMessageRow
from careerpilot.integrations.fake_google import FakeGoogleGateway
from careerpilot.platform.clock import FixedClock, SequentialIdGenerator
from careerpilot.platform.config import PersistenceMode
from careerpilot.platform.files import InMemoryFileStorage
from careerpilot.platform.persistence import SQLITE_MEMORY_URL, Base, create_database
from careerpilot.testing import load_sample_data, sample_database_repositories, sample_settings
from tests.unit.conftest import DEMO_USER, TEST_SECRET, FakeHasher
from tests.unit.integrations.conftest import CLIENT_ID_ENV, CLIENT_SECRET_ENV, EMPLOYER, connect, mail


@pytest.fixture
def stored(clock: FixedClock, gateway: FakeGoogleGateway, monkeypatch: pytest.MonkeyPatch) -> Container:
    monkeypatch.setenv(CLIENT_ID_ENV, "id")
    monkeypatch.setenv(CLIENT_SECRET_ENV, "secret")
    settings = sample_settings()
    settings = settings.model_copy(update={"persistence": settings.persistence.model_copy(update={"mode": PersistenceMode.DATABASE})})
    database = create_database(SQLITE_MEMORY_URL, clock)
    Base.metadata.create_all(database.engine)
    return build_container(
        ContainerOverrides(
            settings=settings,
            clock=clock,
            ids=SequentialIdGenerator(),
            hasher=FakeHasher(),
            token_secret=TEST_SECRET,
            file_storage=InMemoryFileStorage(),
            database=database,
            repositories=sample_database_repositories(load_sample_data(clock.now()), database),
            google_gateway=gateway,
        )
    )


def count(container: Container, row: type[Base]) -> int:
    database = container.database
    assert database is not None
    with database.unit_of_work() as session:
        return session.scalar(select(func.count()).select_from(row)) or 0


def test_connections_messages_and_events_are_stored_with_audit_columns_and_soft_delete(
    stored: Container, gateway: FakeGoogleGateway
) -> None:
    connect(stored)
    gateway.messages["m1"] = mail("m1", EMPLOYER, "Interview invitation", "Please join on 25 October 2026 at 14:30.")
    result = stored.integrations.sync.sync_user(DEMO_USER)
    assert result.messages == 1
    stored.integrations.sync.sync_user(DEMO_USER)
    assert (count(stored, ConnectionRow), count(stored, SyncedMessageRow), count(stored, CalendarEventRow)) == (1, 1, 2)
    database = stored.database
    assert database is not None
    with database.unit_of_work() as session:
        row = session.scalars(select(ConnectionRow)).one()
        assert row.deleted_at is None and row.created_by
        assert "access-1" not in str(row.document) and "refresh-auth-code" not in str(row.document)
    stored.integrations.google.disconnect(DEMO_USER)
    assert stored.integrations.google.status(DEMO_USER).connection is None
    with database.unit_of_work() as session:
        gone = session.scalars(select(ConnectionRow)).one()
        assert gone.deleted_at is not None and gone.delete_reason == "disconnected by the user"
