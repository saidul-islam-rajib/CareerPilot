import json

import pytest

from careerpilot.discovery.connectors.json_jobs import JsonJobsConnector
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
    json_jobs = JsonJobsConnector(config.json_fields, config.date_formats)
    return SourceResolver(pages, first_party_connectors(extra=[json_jobs]), config).resolve(link)


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


def test_career_pages_that_load_jobs_with_scripts_use_the_job_api(config: DiscoveryConfig) -> None:
    career = '<html><head><title>Career | Acme Air</title><script src="/static/career-1.js"></script></head><body>Loading</body></html>'
    script = 'fetch("/api/get-jobs-info").then(r => r.json()); const icons = "/api/icons";'
    api = json.dumps({"data": [{"job_category": "Cabin Crew", "apply_link": "https://acme.example.org/jobs/6/apply"}]})
    pages = FakePages({f"{SITE}career": career, f"{SITE}static/career-1.js": script, f"{SITE}api/get-jobs-info": api})
    assert resolve(config, pages, f"{SITE}career") == ResolvedSource("json", f"{SITE}api/get-jobs-info", "Acme Air", 1)
    assert f"{SITE}api/icons" not in pages.fetched


def test_hiring_platform_boards_are_found_from_a_link_on_the_site(config: DiscoveryConfig) -> None:
    api = "https://jsapi.recruiterbox.com/v1/openings?client_name=acme&limit=100"
    opening = {
        "title": "DevOps Administrator",
        "hosted_url": "https://acme.hire.trakstar.com/jobs/1/",
        "location": {"city": "Dhaka", "country": "Bangladesh"},
    }
    home = '<html><body><a href="https://acme.recruiterbox.com/">Current Openings</a></body></html>'
    pages = FakePages({SITE: home, api: json.dumps({"objects": [opening]})})
    assert resolve(config, pages, SITE) == ResolvedSource("json", api, "Acme", 1)


def test_a_real_board_with_no_openings_today_is_still_accepted(config: DiscoveryConfig) -> None:
    careers = '<html><head><meta property="og:site_name" content="Acme"></head><body><a href="https://www.pinpointhq.com">Powered by</a></body></html>'
    pages = FakePages({SITE: careers, f"{SITE}postings.json": json.dumps({"data": []})})
    assert resolve(config, pages, SITE) == ResolvedSource("json", f"{SITE}postings.json", "Acme", 0)


def test_unknown_apis_without_jobs_are_never_accepted(config: DiscoveryConfig) -> None:
    career = '<html><head><title>Careers | Acme</title><script src="/static/career.js"></script></head></html>'
    pages = FakePages({f"{SITE}career": career, f"{SITE}static/career.js": 'fetch("/api/jobs-list")', f"{SITE}api/jobs-list": "[]"})
    assert resolve(config, pages, f"{SITE}career") is None


def test_career_links_to_another_site_are_followed_but_social_networks_are_not(config: DiscoveryConfig) -> None:
    home = (
        "<html><head><meta property='og:site_name' content='Acme'></head><body>"
        "<a href='https://www.linkedin.com/company/acme/jobs'>Jobs on LinkedIn</a>"
        "<a href='https://hr.example.net/acme/openings'>Career</a></body></html>"
    )
    openings = CAREERS.replace("/careers/jobs/", "https://hr.example.net/acme/openings/")
    pages = FakePages({SITE: home, "https://hr.example.net/acme/openings": openings})
    found = resolve(config, pages, SITE)
    assert found is not None
    assert (found.connector, found.url, found.found) == ("html", "https://hr.example.net/acme/openings", 3)
    assert not any("linkedin.com" in url for url in pages.fetched)
