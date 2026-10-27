import pytest

from careerpilot.administration.adapters.sql import SqlDirectory, SqlPlatformSettingsRepository
from careerpilot.bootstrap import Container, default_platform_settings
from careerpilot.candidate.services.auth import Registration
from careerpilot.platform.clock import FixedClock
from careerpilot.platform.config import load_settings
from careerpilot.platform.email_delivery import InMemoryEmailSender
from careerpilot.platform.enums import ApplicationMode
from careerpilot.platform.errors import DomainError, ErrorCode
from careerpilot.platform.persistence import SQLITE_MEMORY_URL, Base, create_database
from tests.unit.conftest import CLIENT, register_and_activate

FORMER_DEMO_EMAIL = "admin@sober.com"
NEW_PERSON = Registration(
    full_name="First Person", email="first.person@example.com", consent=True, terms_version="1.0", privacy_version="1.0"
)


def test_a_new_system_has_no_people_jobs_or_sources(empty_container: Container) -> None:
    with pytest.raises(DomainError) as user_sign_in:
        empty_container.auth.sign_in(FORMER_DEMO_EMAIL, FORMER_DEMO_EMAIL, CLIENT)
    with pytest.raises(DomainError) as admin_sign_in:
        empty_container.admin_auth.sign_in(FORMER_DEMO_EMAIL, FORMER_DEMO_EMAIL, CLIENT.ip)
    assert user_sign_in.value.code is ErrorCode.INVALID_CREDENTIALS
    assert admin_sign_in.value.code is ErrorCode.INVALID_CREDENTIALS
    assert empty_container.discovery.listings() == []
    assert empty_container.source_checks.due_sources() == []


def test_reference_data_comes_from_config(empty_container: Container) -> None:
    settings = empty_container.settings
    public = empty_container.public_config.get()
    assert len(public["enumValues"]) == len(settings.enum_values)
    assert public["enumValues"][0]["labelKey"] == settings.enum_values[0].label_key
    assert public["theme"] == settings.ui.active_theme.value


def test_new_accounts_start_with_the_configured_default_tracks(empty_container: Container, outbox: InMemoryEmailSender) -> None:
    session = register_and_activate(empty_container, outbox, NEW_PERSON)
    tracks = empty_container.preferences.get(session.user.id).tracks
    assert [(t.id, t.kind, t.result_count) for t in tracks] == [
        (t.id, t.kind, t.result_count) for t in empty_container.settings.tracks.defaults
    ]
    assert {t.mode for t in tracks} == {ApplicationMode.APPROVE_EACH}


def test_an_empty_database_uses_config_defaults(clock: FixedClock) -> None:
    settings = load_settings("local")
    database = create_database(SQLITE_MEMORY_URL, clock)
    Base.metadata.create_all(database.engine)
    defaults = default_platform_settings(settings)
    assert SqlPlatformSettingsRepository(database, defaults).get() == defaults
    operations = SqlDirectory(database).operations()
    assert (operations.services, operations.archived_circulars, operations.user_phones) == ([], 0, {})
