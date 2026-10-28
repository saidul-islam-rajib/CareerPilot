import json
from collections.abc import Callable

import pytest
from fastapi.testclient import TestClient

from careerpilot.administration.context import AdminActor, PageRequest
from careerpilot.administration.models import NewSource, SourceDefaults
from careerpilot.api.admin_app import create_admin_app
from careerpilot.bootstrap import Container, ContainerOverrides, build_container
from careerpilot.discovery.fetchers import HttpFetcher
from careerpilot.discovery.ports import FetchError
from careerpilot.discovery.safety import host_resolves, public_https_url
from careerpilot.platform.clock import FixedClock, SequentialIdGenerator
from careerpilot.platform.config import ListingDefaults, SourceDefinition, repository_root
from careerpilot.platform.email_delivery import InMemoryEmailSender
from careerpilot.platform.enums import OpportunityType, SourceStatus, WorkArrangement
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


def new_source(url: str = FEED_URL, connector: str = "rss") -> NewSource:
    return NewSource(name="Remote board", connector=connector, url=url, defaults=REMOTE)


def failure(action: Callable[[], object]) -> tuple[ErrorCode, str | None]:
    with pytest.raises(DomainError) as raised:
        action()
    return raised.value.code, raised.value.detail


def test_an_added_source_is_checked_at_once_and_scheduled(app: Container, fetcher: RecordingFetcher) -> None:
    admin = actor(app)
    listings_before = len(app.discovery.listings())
    row = app.admin_catalog.add_source(admin, new_source())
    assert row.setup is not None and row.setup.url == FEED_URL
    assert row.status is SourceStatus.HEALTHY
    assert fetcher.fetched[-1] == FEED_URL
    assert row.id in app.source_checks.due_sources()
    assert len(app.discovery.listings()) >= listings_before
    assert [e.action for e in app.admin_audit.list(admin, PageRequest()).items[:2]] == ["source.checked", "source.added"]


def test_unsafe_addresses_and_unknown_connectors_are_refused_without_fetching(app: Container, fetcher: RecordingFetcher) -> None:
    admin = actor(app)
    fetched_before = list(fetcher.fetched)
    assert failure(lambda: app.admin_catalog.add_source(admin, new_source(UNSAFE_URL))) == (ErrorCode.VALIDATION, "source_url")
    assert failure(lambda: app.admin_catalog.add_source(admin, new_source(connector="ftp"))) == (ErrorCode.VALIDATION, "source_connector")
    assert fetcher.fetched == fetched_before


def test_suggestions_hide_sources_already_added_and_duplicates_are_refused(app: Container) -> None:
    admin = actor(app)
    suggestions = app.admin_catalog.suggested_sources(admin)
    assert suggestions and all(s.url.startswith("https://") for s in suggestions)
    app.admin_catalog.add_source(admin, suggestions[0])
    remaining = app.admin_catalog.suggested_sources(admin)
    assert len(remaining) == len(suggestions) - 1
    assert suggestions[0].url not in [s.url for s in remaining]
    assert failure(lambda: app.admin_catalog.add_source(admin, suggestions[0])) == (ErrorCode.CONFLICT, "source_exists")


def test_only_admins_allowed_to_create_sources_can_add_one(app: Container) -> None:
    assert failure(lambda: app.admin_catalog.add_source(actor(app, "operations@sober.com"), new_source()))[0] is ErrorCode.FORBIDDEN


def test_source_endpoints(app: Container) -> None:
    client = TestClient(create_admin_app(app))
    token = client.post("/admin/v1/auth/sign-in", json={"email": "admin@sober.com", "password": PASSWORD}).json()["accessToken"]
    headers = {"Authorization": f"Bearer {token}"}
    assert client.get("/admin/v1/sources/suggestions", headers=headers).status_code == 200
    body = {
        "name": "Remote board",
        "connector": "rss",
        "url": FEED_URL,
        "defaults": {"type": "job", "workArrangement": "remote", "location": "Remote"},
    }
    added = client.post("/admin/v1/sources", headers=headers, json=body)
    assert added.status_code == 200
    assert added.json()["setup"]["url"] == FEED_URL
    bad = client.post("/admin/v1/sources", headers=headers, json={**body, "defaults": {"type": "job", "workArrangement": "anywhere"}})
    assert bad.status_code == 422


def resolving_to(*addresses: str) -> Callable[[str, int], list[str]]:
    def resolve(_host: str, _port: int) -> list[str]:
        return list(addresses)

    return resolve


def test_only_public_https_addresses_pass() -> None:
    public = resolving_to("93.184.215.14")
    assert public_https_url(" https://jobs.example.org/feed.rss#top ", public) == "https://jobs.example.org/feed.rss"
    assert public_https_url("http://jobs.example.org/feed.rss", public) is None
    assert public_https_url("https://user:pass@jobs.example.org/feed.rss", public) is None
    for address in ["10.0.0.7", "127.0.0.1", "169.254.169.254", "::1", "192.168.0.10"]:
        assert public_https_url("https://jobs.example.org/", resolving_to(address)) is None
    assert public_https_url("https://jobs.example.org/", resolving_to("93.184.215.14", "10.0.0.7")) is None


def test_live_fetches_stop_at_unsafe_addresses_before_connecting() -> None:
    fetcher = HttpFetcher(sample_settings().discovery, lambda _url: None, lambda _url: True)
    with pytest.raises(FetchError, match="unsafe_address"):
        fetcher.fetch(
            SourceDefinition(
                connector="rss", url=FEED_URL, defaults=ListingDefaults(type="job", work_arrangement="remote", country_code="")
            )
        )


def test_a_website_link_alone_finds_the_job_board_and_its_jobs(app: Container, site: FakeSite) -> None:
    site.pages.update({SITE: ACME_HOME, LEVER_API: LEVER_BODY})
    row = app.admin_catalog.add_source(actor(app), NewSource(url="acme.example.org"))
    assert row.setup is not None
    assert (row.name, row.setup.connector, row.setup.url, row.setup.site_url) == ("Acme", "lever", LEVER_API, SITE)
    assert (row.status, row.opportunities_found, row.last_error) == (SourceStatus.HEALTHY, 2, "")
    titles = {listing.title for listing in app.discovery.listings() if listing.organization == "Acme"}
    assert titles == {"Backend Engineer", "Data Analyst"}


def test_a_website_without_jobs_is_refused_and_not_saved(app: Container) -> None:
    admin = actor(app)
    before = len(app.admin_catalog.sources(admin, PageRequest(page_size=500)).items)
    outcome = failure(lambda: app.admin_catalog.add_source(admin, NewSource(url="https://empty.example.org")))
    assert outcome == (ErrorCode.VALIDATION, "jobs_not_found")
    assert len(app.admin_catalog.sources(admin, PageRequest(page_size=500)).items) == before


def test_a_source_saved_with_the_wrong_reader_heals_itself_on_the_next_check(app: Container, site: FakeSite) -> None:
    site.pages.update({SITE: ACME_HOME, LEVER_API: LEVER_BODY})
    row = app.admin_catalog.add_source(actor(app), NewSource(url=SITE, name="Acme", connector="rss"))
    assert row.setup is not None
    assert (row.setup.connector, row.setup.url, row.status, row.opportunities_found) == ("lever", LEVER_API, SourceStatus.HEALTHY, 2)


def test_failed_checks_show_why_until_a_check_succeeds(app: Container) -> None:
    admin = actor(app)
    row = app.admin_catalog.add_source(admin, NewSource(url=FEED_URL, name="Broken board", connector="lever"))
    assert (row.status, row.last_error) == (SourceStatus.DEGRADED, "invalid_board")
    assert row.last_checked_at is not None


def test_addresses_that_cannot_be_looked_up_are_reported_as_unreachable() -> None:
    fetcher = HttpFetcher(sample_settings().discovery, lambda _url: None, lambda _url: False)
    with pytest.raises(FetchError, match="unreachable"):
        fetcher.fetch_url(FEED_URL)
    assert not host_resolves("https://jobs.example.org/", resolving_to())
    assert host_resolves("https://jobs.example.org/", resolving_to("93.184.215.14"))
