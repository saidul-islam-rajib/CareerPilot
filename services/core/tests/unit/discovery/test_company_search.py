import json

import httpx
import pytest

from careerpilot.discovery.company_search import (
    CompanySearch,
    KnownCompany,
    SearchProbes,
    company_handles,
    company_words,
    is_personal_email,
    source_query,
)
from careerpilot.discovery.connectors.json_jobs import JsonJobsConnector
from careerpilot.discovery.connectors.registry import first_party_connectors
from careerpilot.discovery.fetchers import HttpFetcher
from careerpilot.discovery.resolver import SourceResolver
from careerpilot.platform.config import DiscoveryConfig
from careerpilot.platform.enums import SourceQueryKind
from careerpilot.platform.similarity import TrigramIndex, similarity
from careerpilot.testing import sample_settings
from tests.unit.discovery.test_resolver import FakePages

PERSONAL = ["gmail.com"]
NORTHWIND_HOME = (
    "<html><head><title>Home | Northwind Robotics</title></head><body><a href='https://jobs.lever.co/nw-robotics'>Careers</a></body></html>"
)
NORTHWIND_LEVER = "https://api.lever.co/v0/postings/nw-robotics?mode=json"
LEVER_BODY = json.dumps([{"text": "Robotics Engineer", "hostedUrl": "https://jobs.lever.co/nw-robotics/1"}])


def easy_jobs(company: str) -> str:
    return json.dumps({"data": {"company": {"name": company}, "jobs": [{"title": "SQA Engineer", "slug": "sqa"}]}})


@pytest.fixture
def config() -> DiscoveryConfig:
    return sample_settings().discovery


def searcher(config: DiscoveryConfig, pages: FakePages) -> CompanySearch:
    json_jobs = JsonJobsConnector(config.json_fields, config.date_formats)
    resolver = SourceResolver(pages, first_party_connectors(extra=[json_jobs]), config)
    return CompanySearch(SearchProbes(pages, resolver, resolver), config)


def test_people_can_type_a_link_a_company_email_or_a_company_name() -> None:
    bare, full = source_query("dsinnovators.com", PERSONAL), source_query("http://dsinnovators.com", PERSONAL)
    assert bare is not None and full is not None and bare.link == full.link == "https://dsinnovators.com"
    link = source_query("www.example.com/careers?team=qa", PERSONAL)
    assert link is not None and (link.kind, link.link) == (SourceQueryKind.LINK, "https://www.example.com/careers?team=qa")
    email = source_query("HR@Northwind.com.bd", PERSONAL)
    assert email is not None and (email.kind, email.link) == (SourceQueryKind.EMAIL, "https://northwind.com.bd")
    name = source_query("  Brain   Station 23 ", PERSONAL)
    assert name is not None and (name.kind, name.text) == (SourceQueryKind.NAME, "Brain Station 23")
    assert source_query("someone@gmail.com", PERSONAL) is None
    assert is_personal_email("someone@gmail.com", PERSONAL)
    assert source_query("12345", PERSONAL) is None


def test_handles_cover_the_full_name_its_initials_and_its_short_forms(config: DiscoveryConfig) -> None:
    words = company_words("Dynamic Solution Innovators Ltd.", frozenset(config.company_search.legal_words))
    handles = [handle.text for handle in company_handles(words, config.company_search)]
    assert handles[0] == "dynamicsolutioninnovators"
    assert "dsinnovators" in handles and "dsi" in handles
    assert len(handles) <= config.company_search.max_handles


def test_the_trigram_index_finds_names_written_differently() -> None:
    index = TrigramIndex([("Brain Station-23 Ltd", "bs23"), ("Northwind Robotics", "nw"), ("Acme", "acme")], frozenset({"ltd"}))
    best = index.best("brainstation 23", 0.6)
    assert best is not None and (best.item, best.score) == ("bs23", 1.0)
    assert index.best("Totally different", 0.6) is None
    assert similarity("Cefalo", "Cefalo Bangladesh", frozenset({"bangladesh"})) == 1.0


def test_a_company_name_finds_its_website_and_then_its_job_board(config: DiscoveryConfig) -> None:
    pages = FakePages({"https://northwindrobotics.com/": NORTHWIND_HOME, NORTHWIND_LEVER: LEVER_BODY})
    match = searcher(config, pages).find("Northwind Robotics Ltd.")
    assert match is not None and match.found is not None
    assert (match.site_url, match.found.connector, match.found.url, match.found.found) == (
        "https://northwindrobotics.com/",
        "lever",
        NORTHWIND_LEVER,
        1,
    )


def test_a_job_board_under_a_guessed_handle_counts_only_when_its_name_matches(config: DiscoveryConfig) -> None:
    pages = FakePages({"https://nr.easy.jobs/api/career/home": easy_jobs("Nordic Rail")})
    assert searcher(config, pages).find("Northwind Robotics") is None
    pages.pages["https://northwindrobotics.easy.jobs/api/career/home"] = easy_jobs("Northwind Robotics Ltd")
    match = searcher(config, pages).find("Northwind Robotics")
    assert match is not None and match.found is not None and match.found.connector == "easyjobs"


def test_known_companies_are_matched_before_searching_the_web(config: DiscoveryConfig) -> None:
    known = [KnownCompany("Brain Station 23 Ltd.", "https://brainstation-23.com"), KnownCompany("Acme", "https://acme.example.org")]
    assert searcher(config, FakePages({})).known("brainstation23", known) == known[0]


def test_redirects_to_plain_http_continue_over_https() -> None:
    requested: list[str] = []

    def answer(request: httpx.Request) -> httpx.Response:
        requested.append(str(request.url))
        if request.url.host == "acme.example.org":
            return httpx.Response(301, headers={"location": "http://www.acme.example.org/"})
        return httpx.Response(200, text="<html>Acme</html>")

    fetcher = HttpFetcher(sample_settings().discovery, lambda _url: None, httpx.MockTransport(answer))
    assert fetcher.fetch_url("https://acme.example.org/") == ("https://www.acme.example.org/", "<html>Acme</html>")
    assert requested == ["https://acme.example.org/", "https://www.acme.example.org/"]
