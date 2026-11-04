from collections.abc import Callable
from dataclasses import dataclass
from urllib.parse import unquote, urlsplit

import pytest

from careerpilot.administration.context import AdminActor
from careerpilot.administration.models import PlatformSettings
from careerpilot.bootstrap import Container, ContainerOverrides, build_container
from careerpilot.integrations.fake_google import FakeGoogleGateway
from careerpilot.platform.clock import FixedClock, SequentialIdGenerator
from careerpilot.platform.email_delivery import InMemoryEmailSender
from careerpilot.platform.files import InMemoryFileStorage
from careerpilot.platform.security import PasswordHasher
from careerpilot.privacy.models import ExportView
from careerpilot.repositories import Repositories, RepositoryFactory, WorkspaceFactory
from careerpilot.testing import load_sample_data, sample_repositories, sample_settings
from tests.unit.conftest import CLIENT, DEMO_USER, TEST_SECRET, FakeHasher
from tests.unit.integrations.conftest import CLIENT_ID_ENV, CLIENT_SECRET_ENV

OWNER_PASSWORD = "admin@sober.com"
BASE_URL = "http://testserver/"
FILES_PREFIX = "/v1/files/"


class RepositoryTap:
    def __init__(self, inner: RepositoryFactory) -> None:
        self._inner = inner
        self.repositories: Repositories | None = None

    def __call__(self, hasher: PasswordHasher, empty: WorkspaceFactory, defaults: PlatformSettings) -> Repositories:
        self.repositories = self._inner(hasher, empty, defaults)
        return self.repositories

    @property
    def repos(self) -> Repositories:
        assert self.repositories is not None
        return self.repositories


class QueuedRunner:
    def __init__(self) -> None:
        self.jobs: list[Callable[[], object]] = []

    def run(self, job: Callable[[], object]) -> None:
        self.jobs.append(job)


@pytest.fixture
def gateway() -> FakeGoogleGateway:
    return FakeGoogleGateway(email="ayesha@gmail.com", scopes=list(sample_settings().integrations.google.scopes))


@pytest.fixture
def storage() -> InMemoryFileStorage:
    return InMemoryFileStorage()


@pytest.fixture
def tap(clock: FixedClock) -> RepositoryTap:
    return RepositoryTap(sample_repositories(load_sample_data(clock.now())))


@dataclass(frozen=True)
class Rig:
    clock: FixedClock
    outbox: InMemoryEmailSender
    gateway: FakeGoogleGateway
    storage: InMemoryFileStorage
    tap: RepositoryTap
    queue: QueuedRunner


@pytest.fixture
def rig(
    clock: FixedClock, outbox: InMemoryEmailSender, gateway: FakeGoogleGateway, storage: InMemoryFileStorage, tap: RepositoryTap
) -> Rig:
    return Rig(clock, outbox, gateway, storage, tap, QueuedRunner())


def build(rig: Rig, runner: QueuedRunner | None) -> Container:
    return build_container(
        ContainerOverrides(
            settings=sample_settings(),
            repositories=rig.tap,
            clock=rig.clock,
            ids=SequentialIdGenerator(),
            hasher=FakeHasher(),
            token_secret=TEST_SECRET,
            file_storage=rig.storage,
            email_sender=rig.outbox,
            google_gateway=rig.gateway,
            job_runner=runner,
        )
    )


@pytest.fixture
def queue(rig: Rig) -> QueuedRunner:
    return rig.queue


@pytest.fixture
def container(rig: Rig, monkeypatch: pytest.MonkeyPatch) -> Container:
    monkeypatch.setenv(CLIENT_ID_ENV, "client-id.apps.example.test")
    monkeypatch.setenv(CLIENT_SECRET_ENV, "client-secret")
    return build(rig, None)


@pytest.fixture
def queued(rig: Rig) -> Container:
    return build(rig, rig.queue)


@pytest.fixture
def admin(container: Container) -> AdminActor:
    return container.admin_auth.authenticate(container.admin_auth.sign_in("admin@sober.com", OWNER_PASSWORD, CLIENT.ip).access_token)


def stored_bytes(storage: InMemoryFileStorage, view: ExportView) -> bytes:
    assert view.download_url is not None
    key = unquote(urlsplit(view.download_url).path.removeprefix(FILES_PREFIX))
    data = storage.get(key)
    assert data is not None
    return data


def request_view(container: Container, view: ExportView) -> ExportView:
    return container.privacy.exports.get(DEMO_USER, view.id, BASE_URL)
