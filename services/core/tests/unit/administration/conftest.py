import json
from collections.abc import Callable

import pytest

from careerpilot.administration.context import AdminActor
from careerpilot.administration.models import SourceDefaults
from careerpilot.bootstrap import Container, ContainerOverrides, build_container
from careerpilot.discovery.ports import FetchError
from careerpilot.platform.clock import FixedClock, SequentialIdGenerator
from careerpilot.platform.config import SourceDefinition, repository_root
from careerpilot.platform.email_delivery import InMemoryEmailSender
from careerpilot.platform.enums import OpportunityType, WorkArrangement
from careerpilot.platform.errors import DomainError, ErrorCode
from careerpilot.platform.files import InMemoryFileStorage
from careerpilot.testing import DISCOVERY_FIXTURES_FILE, load_sample_data, sample_repositories, sample_settings
from tests.unit.conftest import CLIENT, TEST_SECRET, FakeHasher

PASSWORD = "admin@sober.com"
FEED_URL = "https://jobs.example.org/remote.rss"
UNSAFE_URL = "https://intranet.example.org/feed.rss"
FIXTURES = repository_root() / DISCOVERY_FIXTURES_FILE.parent
REMOTE = SourceDefaults(type=OpportunityType.JOB, work_arrangement=WorkArrangement.REMOTE, location="Remote")
SITE = "https://acme.example.org"
LEVER_API = "https://api.lever.co/v0/postings/acme?mode=json"
LEVER_BODY = json.dumps(
    [
        {"text": "Backend Engineer", "hostedUrl": "https://jobs.lever.co/acme/1", "descriptionPlain": "Python APIs"},
        {"text": "Data Analyst", "hostedUrl": "https://jobs.lever.co/acme/2", "descriptionPlain": "SQL"},
    ]
)
ACME_HOME = (
    '<html><head><meta property="og:site_name" content="Acme"></head><body><a href="https://jobs.lever.co/acme">Careers</a></body></html>'
)


class FakeSite:
    def __init__(self) -> None:
        self.pages: dict[str, str] = {}

    def __call__(self, url: str) -> tuple[str, str]:
        if url not in self.pages:
            raise FetchError("unreachable")
        return url, self.pages[url]


class RecordingFetcher:
    def __init__(self, site: FakeSite) -> None:
        self.fetched: list[str] = []
        self.site = site

    def fetch(self, definition: SourceDefinition) -> str:
        self.fetched.append(definition.url)
        if definition.url in self.site.pages:
            return self.site.pages[definition.url]
        fixture = "northwind-greenhouse.json" if definition.connector == "greenhouse" else "remote-board.rss"
        return (FIXTURES / fixture).read_text(encoding="utf-8")


def accept_except(*unsafe: str) -> Callable[[str], str | None]:
    return lambda url: None if url in unsafe else url


@pytest.fixture
def site() -> FakeSite:
    return FakeSite()


@pytest.fixture
def fetcher(site: FakeSite) -> RecordingFetcher:
    return RecordingFetcher(site)


@pytest.fixture
def app(clock: FixedClock, outbox: InMemoryEmailSender, fetcher: RecordingFetcher, site: FakeSite) -> Container:
    overrides = ContainerOverrides(
        settings=sample_settings(),
        repositories=sample_repositories(load_sample_data(clock.now())),
        clock=clock,
        ids=SequentialIdGenerator(),
        hasher=FakeHasher(),
        token_secret=TEST_SECRET,
        file_storage=InMemoryFileStorage(),
        email_sender=outbox,
        fetcher=fetcher,
        address_check=accept_except(UNSAFE_URL),
        page_fetcher=site,
    )
    return build_container(overrides)


def actor(app: Container, email: str = "admin@sober.com") -> AdminActor:
    return app.admin_auth.authenticate(app.admin_auth.sign_in(email, PASSWORD, CLIENT.ip).access_token)


def failure(action: Callable[[], object]) -> tuple[ErrorCode, str | None]:
    with pytest.raises(DomainError) as raised:
        action()
    return raised.value.code, raised.value.detail
