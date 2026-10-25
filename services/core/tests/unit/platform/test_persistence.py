from datetime import timedelta

import pytest

from careerpilot.administration.context import PageRequest
from careerpilot.bootstrap import Container, ContainerOverrides, build_container
from careerpilot.candidate.adapters.sql import SqlAccountRepository, UserAccountRow
from careerpilot.candidate.models import UserSummary
from careerpilot.candidate.ports import Account
from careerpilot.platform.clock import FixedClock, SequentialIdGenerator
from careerpilot.platform.config import PersistenceMode, load_settings
from careerpilot.platform.enums import ActorType, ApplicationFilter, ThemeKey, UserAccountStatus
from careerpilot.platform.persistence import SQLITE_MEMORY_URL, Actor, Base, PhysicalDeleteError, acting_as, active, create_database
from tests.unit.conftest import CLIENT, DEMO_USER, TEST_SECRET, FakeHasher


def account(user_id: str = "usr_x", email: str = "x@example.com") -> Account:
    return Account(user=UserSummary(id=user_id, full_name="X Person", email=email), password_hash="h", status=UserAccountStatus.ACTIVE)


def test_audit_columns_are_set_automatically(clock: FixedClock) -> None:
    database = create_database(SQLITE_MEMORY_URL, clock)
    Base.metadata.create_all(database.engine)
    repository = SqlAccountRepository(database)
    with acting_as(Actor("usr_x", ActorType.USER)):
        repository.add(account())
    clock.advance(timedelta(minutes=5))
    with acting_as(Actor("adm_1", ActorType.ADMIN)):
        updated = account()
        updated.status = UserAccountStatus.SUSPENDED
        repository.save(updated)
    with database.unit_of_work() as session:
        row = session.get(UserAccountRow, "usr_x")
        assert row is not None
        assert (row.created_by, row.created_by_type) == ("usr_x", "user")
        assert (row.updated_by, row.updated_by_type) == ("adm_1", "admin")
        assert row.updated_at > row.created_at
        assert row.version == 2


def test_physical_delete_is_refused_and_soft_delete_hides_rows(clock: FixedClock) -> None:
    database = create_database(SQLITE_MEMORY_URL, clock)
    Base.metadata.create_all(database.engine)
    repository = SqlAccountRepository(database)
    repository.add(account())
    with pytest.raises(PhysicalDeleteError), database.unit_of_work() as session:
        session.delete(session.get(UserAccountRow, "usr_x"))
    with database.unit_of_work() as session:
        row = session.get(UserAccountRow, "usr_x")
        assert row is not None
        row.soft_delete(clock, "user request")
    assert repository.get("usr_x") is None
    with database.unit_of_work() as session:
        assert session.scalars(active(UserAccountRow)).first() is None
        deleted = session.get(UserAccountRow, "usr_x")
        assert deleted is not None
        assert deleted.delete_reason == "user request"


def test_email_is_unique_among_active_accounts(clock: FixedClock) -> None:
    database = create_database(SQLITE_MEMORY_URL, clock)
    Base.metadata.create_all(database.engine)
    repository = SqlAccountRepository(database)
    repository.add(account())
    with pytest.raises(Exception, match="UNIQUE"):
        repository.add(account("usr_y"))


@pytest.fixture
def database_container(clock: FixedClock) -> Container:
    settings = load_settings("local")
    settings = settings.model_copy(update={"persistence": settings.persistence.model_copy(update={"mode": PersistenceMode.DATABASE})})
    database = create_database(SQLITE_MEMORY_URL, clock)
    Base.metadata.create_all(database.engine)
    overrides = ContainerOverrides(
        settings=settings, clock=clock, ids=SequentialIdGenerator(), hasher=FakeHasher(), token_secret=TEST_SECRET, database=database
    )
    return build_container(overrides)


def test_services_work_on_the_database(database_container: Container) -> None:
    container = database_container
    session = container.auth.sign_in("admin@sober.com", "admin@sober.com", CLIENT)
    assert container.auth.authenticate(session.access_token).id == DEMO_USER
    assert container.dashboard.get(DEMO_USER).counts.awaiting_approval == 2
    container.approvals.approve(DEMO_USER, "apr_frontend")
    assert any(a.opportunity.id == "opp_remote_frontend" for a in container.applications.list(DEMO_USER, ApplicationFilter.ACTIVE))
    admin = container.admin_auth.authenticate(container.admin_auth.sign_in("admin@sober.com", "admin@sober.com", CLIENT.ip).access_token)
    assert container.admin_dashboard.get(admin).users.total == 14
    container.admin_settings.update(admin, {"active_theme": ThemeKey.ORCHID})
    assert container.public_config.get()["theme"] == "orchid"
    assert container.admin_audit.list(admin, PageRequest(page_size=5)).items[0].action == "settings.updated"
