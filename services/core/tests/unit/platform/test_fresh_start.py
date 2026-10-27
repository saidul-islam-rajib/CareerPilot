import pytest

from careerpilot.administration.adapters.sql import SqlDirectory, SqlPlatformSettingsRepository
from careerpilot.bootstrap import Container, ContainerOverrides, build_container, default_platform_settings
from careerpilot.candidate.services.auth import Registration
from careerpilot.platform.clock import FixedClock, SequentialIdGenerator
from careerpilot.platform.config import load_settings
from careerpilot.platform.email_delivery import InMemoryEmailSender
from careerpilot.platform.enums import ApplicationMode
from careerpilot.platform.errors import DomainError, ErrorCode
from careerpilot.platform.files import InMemoryFileStorage
from careerpilot.platform.persistence import SQLITE_MEMORY_URL, Base, create_database
from tests.unit.conftest import CLIENT, TEST_SECRET, FakeHasher, register_and_activate

FORMER_DEMO_EMAIL = "admin@sober.com"
NEW_PERSON = Registration(
    full_name="First Person", email="first.person@example.com", consent=True, terms_version="1.0", privacy_version="1.0"
)


@pytest.fixture
def fresh(clock: FixedClock, outbox: InMemoryEmailSender) -> Container:
    overrides = ContainerOverrides(
        settings=load_settings("local"),
        clock=clock,
        ids=SequentialIdGenerator(),
        hasher=FakeHasher(),
        token_secret=TEST_SECRET,
        file_storage=InMemoryFileStorage(),
        email_sender=outbox,
    )
    return build_container(overrides)


def test_a_new_system_has_no_people_jobs_or_sources(fresh: Container) -> None:
    with pytest.raises(DomainError) as user_sign_in:
        fresh.auth.sign_in(FORMER_DEMO_EMAIL, FORMER_DEMO_EMAIL, CLIENT)
    with pytest.raises(DomainError) as admin_sign_in:
        fresh.admin_auth.sign_in(FORMER_DEMO_EMAIL, FORMER_DEMO_EMAIL, CLIENT.ip)
    assert user_sign_in.value.code is ErrorCode.INVALID_CREDENTIALS
    assert admin_sign_in.value.code is ErrorCode.INVALID_CREDENTIALS
    assert fresh.discovery.listings() == []
    assert fresh.source_checks.due_sources() == []


def test_reference_data_comes_from_config(fresh: Container) -> None:
    settings = fresh.settings
    public = fresh.public_config.get()
    assert len(public["enumValues"]) == len(settings.enum_values)
    assert public["enumValues"][0]["labelKey"] == settings.enum_values[0].label_key
    assert public["theme"] == settings.ui.active_theme.value


def test_new_accounts_start_with_the_configured_default_tracks(fresh: Container, outbox: InMemoryEmailSender) -> None:
    session = register_and_activate(fresh, outbox, NEW_PERSON)
    tracks = fresh.preferences.get(session.user.id).tracks
    assert [(t.id, t.kind, t.result_count) for t in tracks] == [(t.id, t.kind, t.result_count) for t in fresh.settings.tracks.defaults]
    assert {t.mode for t in tracks} == {ApplicationMode.APPROVE_EACH}


def test_an_empty_database_uses_config_defaults(clock: FixedClock) -> None:
    settings = load_settings("local")
    database = create_database(SQLITE_MEMORY_URL, clock)
    Base.metadata.create_all(database.engine)
    defaults = default_platform_settings(settings)
    assert SqlPlatformSettingsRepository(database, defaults).get() == defaults
    operations = SqlDirectory(database).operations()
    assert (operations.services, operations.archived_circulars, operations.user_phones) == ([], 0, {})
