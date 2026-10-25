from pathlib import Path

import pytest

from careerpilot.administration.context import PageRequest
from careerpilot.administration.discovery_sync import source_row_after
from careerpilot.administration.models import AdminSourceRow
from careerpilot.bootstrap import Container
from careerpilot.discovery.adapters.in_memory import InMemoryListingCatalog
from careerpilot.discovery.connectors.greenhouse import GreenhouseConnector
from careerpilot.discovery.connectors.registry import ConnectorRegistry, first_party_connectors
from careerpilot.discovery.connectors.rss import RssConnector
from careerpilot.discovery.fetchers import FixtureFetcher
from careerpilot.discovery.models import CheckOutcome, ListingChange, RawListing, SourceCheck, WarningSign
from careerpilot.discovery.ports import FetchError
from careerpilot.discovery.screening import WarningSignScreen
from careerpilot.discovery.service import DiscoveryContext, DiscoveryService
from careerpilot.discovery.text import canonical_url, listing_fingerprint, plain_text
from careerpilot.platform.clock import FixedClock, SequentialIdGenerator
from careerpilot.platform.config import DiscoveryConfig, SourceDefinition, load_settings, repository_root
from careerpilot.platform.enums import OpportunityStatus, SourceStatus
from careerpilot.platform.errors import DomainError
from tests.unit.conftest import CLIENT

REMOTE = "src_remote_board"
COMPANY = "src_company_pages"
ALL = PageRequest(page_size=500)


class FakeFetcher:
    def __init__(self, bodies: dict[str, str]) -> None:
        self.bodies = bodies

    def fetch(self, definition: SourceDefinition) -> str:
        if definition.url not in self.bodies:
            raise FetchError("unreachable")
        return self.bodies[definition.url]


@pytest.fixture
def config() -> DiscoveryConfig:
    return load_settings("local").discovery


def fixture_text(config: DiscoveryConfig, source_id: str) -> str:
    return (repository_root() / config.fixture_root / config.sources[source_id].fixture).read_text(encoding="utf-8")


def service(config: DiscoveryConfig, clock: FixedClock, bodies: dict[str, str]) -> DiscoveryService:
    return DiscoveryService(
        DiscoveryContext(config, clock, SequentialIdGenerator(), first_party_connectors(), FakeFetcher(bodies), InMemoryListingCatalog())
    )


def recorded(config: DiscoveryConfig) -> dict[str, str]:
    return {config.sources[s].url: fixture_text(config, s) for s in (REMOTE, COMPANY)}


def test_rss_connector_splits_organization_and_title(config: DiscoveryConfig) -> None:
    feed = RssConnector().parse(fixture_text(config, REMOTE), config.sources[REMOTE])
    first = feed.listings[0]
    assert (first.organization, first.title) == ("Kite Commerce", "Senior Backend Engineer (Python)")
    assert first.work_arrangement == "remote"
    assert first.published_at is not None and first.published_at.startswith("2026-10-23")
    assert "<p>" not in first.description
    assert feed.skipped == 0


def test_rss_connector_reads_atom_and_skips_incomplete_items(config: DiscoveryConfig) -> None:
    atom = (
        '<feed xmlns="http://www.w3.org/2005/Atom">'
        '<entry><title>Acme: Analyst</title><link href="https://acme.example/jobs/1"/><summary>Data work</summary></entry>'
        "<entry><title>No organization here</title><link href='https://acme.example/jobs/2'/></entry>"
        "</feed>"
    )
    feed = RssConnector().parse(atom, config.sources[REMOTE])
    assert [item.title for item in feed.listings] == ["Analyst"]
    assert feed.skipped == 1


def test_rss_connector_rejects_unsafe_or_broken_xml(config: DiscoveryConfig) -> None:
    entity_bomb = '<?xml version="1.0"?><!DOCTYPE x [<!ENTITY a "aaaa">]><rss>&a;</rss>'
    with pytest.raises(FetchError):
        RssConnector().parse(entity_bomb, config.sources[REMOTE])
    with pytest.raises(FetchError):
        RssConnector().parse("<rss><channel>", config.sources[REMOTE])


def test_greenhouse_connector_uses_board_defaults(config: DiscoveryConfig) -> None:
    feed = GreenhouseConnector().parse(fixture_text(config, COMPANY), config.sources[COMPANY])
    assert [item.title for item in feed.listings] == ["Senior Frontend Engineer", "Platform Engineer"]
    assert {item.organization for item in feed.listings} == {"Northwind Labs"}
    assert feed.listings[0].location == "Dhaka, Bangladesh"
    with pytest.raises(FetchError):
        GreenhouseConnector().parse("not json", config.sources[COMPANY])


def test_registry_rejects_incompatible_plugins() -> None:
    class OldConnector(RssConnector):
        interface_version = 0

    with pytest.raises(ValueError, match="rss"):
        ConnectorRegistry([OldConnector()])
    assert first_party_connectors().keys() == ["greenhouse", "rss"]


def test_fingerprint_and_url_ignore_formatting() -> None:
    assert listing_fingerprint("Kite Commerce", "Senior  Backend Engineer", "Remote") == listing_fingerprint(
        "KITE COMMERCE", "senior backend engineer!", " remote "
    )
    assert listing_fingerprint("Kite", "Backend Engineer", "Remote") != listing_fingerprint("Kite", "Frontend Engineer", "Remote")
    assert canonical_url("HTTPS://Jobs.Example.com/a/?utm_source=x#top") == "https://jobs.example.com/a"
    assert plain_text("&lt;p&gt;Hello&amp;nbsp;<b>there</b>&lt;/p&gt;") == "Hello there"


def test_warning_signs_are_specific(config: DiscoveryConfig) -> None:
    screen = WarningSignScreen(config.warning_signs)
    raw = RawListing(
        url="https://x.example/1",
        title="Data entry",
        organization="Quick Jobs",
        location="",
        country_code="BD",
        work_arrangement="remote",
        type="job",
        description="Guaranteed job! Pay a Registration Fee. Send your bank account number to hr.quick@gmail.com",
    )
    assert screen.screen(raw) == [
        WarningSign.UPFRONT_FEE,
        WarningSign.GUARANTEED_OFFER,
        WarningSign.SENSITIVE_DATA_REQUEST,
        WarningSign.PERSONAL_EMAIL_CONTACT,
    ]
    clean = RawListing(raw.url, "Engineer", "Kite", "", "BD", "remote", "job", "Apply at careers@kite.example")
    assert screen.screen(clean) == []


def test_discovery_finds_new_listings_and_flags_suspicious_ones(config: DiscoveryConfig, clock: FixedClock) -> None:
    discovery = service(config, clock, recorded(config))
    check = discovery.run(REMOTE)
    assert check.outcome is CheckOutcome.SUCCEEDED
    assert check.found == 3
    new = check.listings(ListingChange.NEW)
    flagged = [item for item in new if item.status is OpportunityStatus.FLAGGED]
    assert [item.organization for item in flagged] == ["Quick Jobs Agency"]
    assert WarningSign.UPFRONT_FEE in flagged[0].warnings
    assert all(len(item.versions) == 1 and item.sources[0].source_id == REMOTE for item in new)


def test_rerun_is_unchanged_and_content_changes_are_archived(config: DiscoveryConfig, clock: FixedClock) -> None:
    bodies = recorded(config)
    discovery = service(config, clock, bodies)
    discovery.run(REMOTE)
    again = discovery.run(REMOTE)
    assert len(again.listings(ListingChange.UNCHANGED)) == 3
    assert not again.listings(ListingChange.NEW)
    url = config.sources[REMOTE].url
    bodies[url] = bodies[url].replace("Playwright and Jest", "Playwright, Cypress, and Jest")
    changed = discovery.run(REMOTE).listings(ListingChange.UPDATED)
    assert len(changed) == 1
    assert [len(v.text) > 0 for v in changed[0].versions] == [True, True]
    assert "Cypress" in changed[0].description
    assert len(discovery.listings()) == 3


def test_same_opportunity_on_two_sources_is_grouped(config: DiscoveryConfig, clock: FixedClock) -> None:
    bodies = recorded(config)
    repost = bodies[config.sources[REMOTE].url].replace(
        "weworkremotely.com/remote-jobs/kite-commerce-senior-backend-engineer-python", "weworkremotely.com/remote-jobs/kite-repost-77"
    )
    discovery = service(config, clock, bodies)
    discovery.run(REMOTE)
    bodies[config.sources[REMOTE].url] = repost
    check = discovery.run(REMOTE)
    assert not check.listings(ListingChange.NEW)
    kite = next(item for item in discovery.listings() if item.organization == "Kite Commerce")
    assert len(kite.sources) == 2


def test_unreachable_and_unconfigured_sources(config: DiscoveryConfig, clock: FixedClock) -> None:
    discovery = service(config, clock, {})
    failed = discovery.run(REMOTE)
    assert failed.outcome is CheckOutcome.FAILED
    assert failed.error == "unreachable"
    with pytest.raises(DomainError):
        discovery.run("src_gov_notices")


def test_fixture_fetcher_reads_recorded_responses(config: DiscoveryConfig) -> None:
    fetcher = FixtureFetcher(repository_root() / config.fixture_root)
    assert "<rss" in fetcher.fetch(config.sources[REMOTE])
    with pytest.raises(FetchError):
        FixtureFetcher(Path("missing")).fetch(config.sources[REMOTE])


def source_row(**changes: object) -> AdminSourceRow:
    base = AdminSourceRow(id=REMOTE, name="Remote", status=SourceStatus.HEALTHY, enabled=True, failures_last24h=0, opportunities_found=10)
    return base.model_copy(update=changes)


def test_source_health_follows_check_outcomes() -> None:
    failed = SourceCheck(REMOTE, CheckOutcome.FAILED, "2026-10-20T06:00:00Z", found=0)
    assert source_row_after(source_row(), failed, 3).status is SourceStatus.DEGRADED
    assert source_row_after(source_row(failures_last24h=2), failed, 3).status is SourceStatus.FAILING
    partial = SourceCheck(REMOTE, CheckOutcome.PARTIAL, "2026-10-20T06:00:00Z", found=1)
    after = source_row_after(source_row(failures_last24h=2), partial, 3)
    assert (after.status, after.failures_last24h, after.last_success_at) == (SourceStatus.DEGRADED, 0, "2026-10-20T06:00:00Z")


def test_container_seeds_discovery_and_admin_sees_new_opportunities(container: Container) -> None:
    titles = {item.title for item in container.discovery.listings()}
    assert {"Senior Backend Engineer (Python)", "Platform Engineer"} <= titles
    admin = container.admin_auth.authenticate(container.admin_auth.sign_in("admin@sober.com", "admin@sober.com", CLIENT.ip).access_token)
    rows = container.admin_catalog.opportunities(admin, ALL).items
    assert any(row.title == "Platform Engineer" for row in rows)
    remote = next(s for s in container.admin_catalog.sources(admin, ALL).items if s.id == REMOTE)
    assert remote.opportunities_found >= 3
