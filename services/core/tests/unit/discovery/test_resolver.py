import json

import pytest

from careerpilot.discovery.connectors.registry import first_party_connectors
from careerpilot.discovery.ports import FetchError
from careerpilot.discovery.resolver import ResolvedSource, SourceResolver, normalized_link
from careerpilot.platform.config import DiscoveryConfig
from careerpilot.testing import sample_settings

SITE = "https://acme.example.org/"
LEVER_API = "https://api.lever.co/v0/postings/acme-labs?mode=json"
EASY_BOARD = "https://acme.easy.jobs/api/career/home"
LEVER_BODY = json.dumps([{"text": "Backend Engineer", "hostedUrl": "https://jobs.lever.co/acme-labs/1"}])
EASY_BODY = json.dumps({"data": {"company": {"name": "Acme Ltd"}, "jobs": [{"title": "SQA Engineer", "slug": "sqa"}]}})
HOME = '<html><head><meta property="og:site_name" content="Acme"></head><body><a href="/careers">Careers</a></body></html>'
CAREERS = """
<html><body>
<a href="/careers/jobs/backend-engineer">Backend Engineer</a>
<a href="/careers/jobs/frontend-engineer">Frontend Engineer</a>
<a href="/careers/jobs/data-analyst">Data Analyst</a>
</body></html>
"""
FEED = """<?xml version="1.0"?><rss><channel>
<item><title>Acme: Support Agent</title><link>https://acme.example.org/jobs/support</link><description>Help</description></item>
</channel></rss>"""


class FakePages:
    def __init__(self, pages: dict[str, str]) -> None:
        self.pages = pages
        self.fetched: list[str] = []

    def __call__(self, url: str) -> tuple[str, str]:
        self.fetched.append(url)
        if url not in self.pages:
            raise FetchError("unreachable")
        return url, self.pages[url]


@pytest.fixture
def config() -> DiscoveryConfig:
    return sample_settings().discovery


def resolve(config: DiscoveryConfig, pages: FakePages, link: str) -> ResolvedSource | None:
    return SourceResolver(pages, first_party_connectors(), config).resolve(link)


def test_links_without_a_secure_scheme_become_https() -> None:
    assert normalized_link(" acme.example.org ") == "https://acme.example.org"
    assert normalized_link("http://acme.example.org/jobs") == "https://acme.example.org/jobs"
    assert normalized_link("https://acme.example.org") == "https://acme.example.org"


def test_job_board_links_resolve_to_the_board_api_without_crawling(config: DiscoveryConfig) -> None:
    pages = FakePages({LEVER_API: LEVER_BODY})
    assert resolve(config, pages, "https://jobs.lever.co/acme-labs") == ResolvedSource("lever", LEVER_API, "Acme Labs", 1)
    assert pages.fetched == [LEVER_API]


def test_company_sites_that_link_to_a_job_board_use_the_board(config: DiscoveryConfig) -> None:
    home = '<html><body><a href="https://acme.easy.jobs">Join us</a></body></html>'
    pages = FakePages({"https://acme.example.org": home, EASY_BOARD: EASY_BODY})
    assert resolve(config, pages, "acme.example.org") == ResolvedSource("easyjobs", EASY_BOARD, "Acme Ltd", 1)


def test_career_pages_are_followed_until_job_links_appear(config: DiscoveryConfig) -> None:
    pages = FakePages({SITE: HOME, f"{SITE}careers": CAREERS})
    assert resolve(config, pages, SITE) == ResolvedSource("html", f"{SITE}careers", "Acme", 3)


def test_job_feeds_are_used_directly(config: DiscoveryConfig) -> None:
    feed_url = f"{SITE}jobs.rss"
    found = resolve(config, FakePages({feed_url: FEED}), feed_url)
    assert found == ResolvedSource("rss", feed_url, "Acme", 1)


def test_sites_without_jobs_resolve_to_nothing_within_the_page_budget(config: DiscoveryConfig) -> None:
    pages = FakePages({SITE: HOME})
    assert resolve(config, pages, SITE) is None
    assert len(pages.fetched) <= config.max_resolve_pages
    assert len(set(pages.fetched)) == len(pages.fetched)
