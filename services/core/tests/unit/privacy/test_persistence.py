from datetime import timedelta

import pytest
from sqlalchemy import func, select

from careerpilot.bootstrap import Container, ContainerOverrides, build_container
from careerpilot.platform.clock import FixedClock, SequentialIdGenerator
from careerpilot.platform.config import PersistenceMode
from careerpilot.platform.email_delivery import InMemoryEmailSender
from careerpilot.platform.files import InMemoryFileStorage
from careerpilot.platform.persistence import SQLITE_MEMORY_URL, Base, create_database
from careerpilot.privacy.adapters.sql import AccountDeletionRow, ConsentRow, DataExportRow
from careerpilot.privacy.enums import ConsentKind, ExportFormat, ExportKind, ExportStatus
from careerpilot.privacy.exports import ExportSpec
from careerpilot.testing import load_sample_data, sample_database_repositories, sample_settings
from tests.unit.conftest import CLIENT, DEMO_USER, TEST_SECRET, FakeHasher
from tests.unit.privacy.conftest import BASE_URL, OWNER_PASSWORD


@pytest.fixture
def stored(clock: FixedClock, outbox: InMemoryEmailSender) -> Container:
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
            email_sender=outbox,
        )
    )


def count(container: Container, row: type[Base]) -> int:
    assert container.database is not None
    with container.database.unit_of_work() as session:
        return session.scalar(select(func.count()).select_from(row)) or 0


def test_exports_deletions_and_consents_round_trip_through_sql(stored: Container, clock: FixedClock) -> None:
    exports = stored.privacy.exports
    view = exports.request(DEMO_USER, ExportSpec(ExportKind.APPLICATIONS, ExportFormat.CSV))
    exports.process(view.id)
    assert exports.get(DEMO_USER, view.id, BASE_URL).status is ExportStatus.READY
    stored.privacy.consents.update(DEMO_USER, ConsentKind.ANALYTICS, True, CLIENT)
    assert stored.privacy.consents.overview(DEMO_USER).history[0].kind is ConsentKind.ANALYTICS
    stored.privacy.deletion.request(DEMO_USER, OWNER_PASSWORD)
    clock.advance(timedelta(days=15))
    assert stored.privacy.deletion.process_due() == 1
    assert stored.privacy.deletion.view(DEMO_USER).status is None
    assert (count(stored, DataExportRow), count(stored, AccountDeletionRow), count(stored, ConsentRow)) == (1, 1, 1)
