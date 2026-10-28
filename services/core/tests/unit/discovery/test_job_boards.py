import json

import pytest

from careerpilot.discovery.connectors.ashby import AshbyConnector
from careerpilot.discovery.connectors.easyjobs import EasyJobsConnector
from careerpilot.discovery.connectors.html import HtmlConnector
from careerpilot.discovery.connectors.json_jobs import JsonJobsConnector
from careerpilot.discovery.connectors.lever import LeverConnector
from careerpilot.discovery.connectors.smartrecruiters import SmartRecruitersConnector
from careerpilot.discovery.connectors.workable import WorkableConnector
from careerpilot.discovery.ports import FetchError
from careerpilot.platform.config import ListingDefaults, SourceDefinition
from careerpilot.testing import sample_settings

ACME = ListingDefaults(type="job", work_arrangement="not_stated", country_code="", organization="Acme")
LISTED_PAGE = """
<html><head><meta property="og:site_name" content="Acme"><title>Jobs</title></head><body>
<a href="/jobs/backend-engineer-12">Backend Engineer</a>
<a href="/jobs/frontend-engineer-13"> Frontend   Engineer </a>
<a href="/jobs/backend-engineer-12">Apply</a>
<a href="/jobs/">All jobs</a>
<a href="/about">About us</a>
</body></html>
"""
POSTING_PAGE = """
<html><head><title>Careers | Acme</title>
<script type="application/ld+json">
{"@context": "https://schema.org", "@graph": [{"@type": "JobPosting", "title": "Data Analyst",
 "url": "https://acme.example.org/jobs/data-analyst", "hiringOrganization": {"name": "Acme Analytics"},
 "jobLocation": {"address": {"addressLocality": "Dhaka", "addressCountry": "BD"}},
 "jobLocationType": "TELECOMMUTE", "description": "<p>SQL and dashboards</p>",
 "validThrough": "2026-03-01T00:00:00Z"}]}
</script></head><body></body></html>
"""


def definition(connector: str, url: str = "https://boards.example.org/acme") -> SourceDefinition:
    return SourceDefinition(connector=connector, url=url, defaults=ACME)


def test_lever_postings_become_listings() -> None:
    body = json.dumps(
        [
            {
                "text": "Backend Engineer",
                "hostedUrl": "https://jobs.lever.co/acme/1",
                "categories": {"location": "Dhaka"},
                "country": "bd",
                "workplaceType": "remote",
                "descriptionPlain": "Build APIs",
                "lists": [{"text": "Requirements", "content": "<li>Python</li>"}],
                "createdAt": 1767225600000,
            },
            {"text": "", "hostedUrl": "https://jobs.lever.co/acme/2"},
        ]
    )
    feed = LeverConnector().parse(body, definition("lever"))
    [job] = feed.listings
    assert feed.skipped == 1
    assert (job.title, job.organization, job.location, job.country_code, job.work_arrangement) == (
        "Backend Engineer",
        "Acme",
        "Dhaka",
        "BD",
        "remote",
    )
    assert "Python" in job.description
    assert job.published_at is not None and job.published_at.startswith("2026-01-01")


def test_ashby_skips_unlisted_jobs_and_reads_remote_roles() -> None:
    body = json.dumps(
        {
            "jobs": [
                {
                    "title": "Designer",
                    "jobUrl": "https://jobs.ashbyhq.com/acme/1",
                    "location": "Remote",
                    "isRemote": True,
                    "descriptionPlain": "Figma",
                    "address": {"postalAddress": {"addressCountry": "US"}},
                },
                {"title": "Hidden", "jobUrl": "https://jobs.ashbyhq.com/acme/2", "isListed": False},
            ]
        }
    )
    [job] = AshbyConnector().parse(body, definition("ashby")).listings
    assert (job.title, job.work_arrangement, job.country_code, job.description) == ("Designer", "remote", "US", "Figma")


def test_workable_uses_the_account_name_as_organization() -> None:
    body = json.dumps(
        {
            "name": "Hugging Face",
            "jobs": [
                {
                    "title": "ML Engineer",
                    "url": "https://apply.workable.com/j/ABC",
                    "telecommuting": True,
                    "locations": [{"city": "Paris", "country": "France", "countryCode": "FR"}],
                    "description": "<p>Train models</p>",
                }
            ],
        }
    )
    [job] = WorkableConnector().parse(body, definition("workable")).listings
    assert (job.organization, job.location, job.country_code, job.work_arrangement) == ("Hugging Face", "Paris, France", "FR", "remote")
    assert job.description == "Train models"


def test_smartrecruiters_builds_posting_links() -> None:
    body = json.dumps(
        {
            "content": [
                {
                    "id": "744",
                    "name": "Accountant",
                    "company": {"identifier": "Acme1", "name": "Acme Corp"},
                    "location": {"city": "Dhaka", "country": "bd", "remote": False},
                    "function": {"label": "Finance"},
                }
            ]
        }
    )
    [job] = SmartRecruitersConnector().parse(body, definition("smartrecruiters")).listings
    assert job.url == "https://jobs.smartrecruiters.com/Acme1/744"
    assert (job.organization, job.country_code, job.description) == ("Acme Corp", "BD", "Finance")


def test_easyjobs_reads_the_board_and_job_details() -> None:
    board = {
        "data": {
            "company": {"name": "Brain Station 23"},
            "jobs": [
                {
                    "title": "SQA Engineer",
                    "slug": "sqa-engineer-abc",
                    "job_type": "on-site",
                    "expire_at": "2026-02-01",
                    "address": {"city": {"name": "Dhaka"}, "country": {"name": "Bangladesh", "sort_name": "BD"}},
                },
                {"title": "Untitled"},
            ],
        }
    }
    details = {"data": {"post": {"requirements": "<p>Selenium</p>", "skills": [{"name": "Python"}]}}}
    fetched: list[str] = []

    def fetch_page(url: str) -> str:
        fetched.append(url)
        return json.dumps(details)

    connector = EasyJobsConnector(fetch_page, max_details=1)
    feed = connector.parse(json.dumps(board), definition("easyjobs", "https://bs23.easy.jobs/api/career/home"))
    [job] = feed.listings
    assert feed.skipped == 1
    assert job.url == "https://bs23.easy.jobs/sqa-engineer-abc"
    assert (job.organization, job.location, job.country_code, job.work_arrangement) == (
        "Brain Station 23",
        "Dhaka, Bangladesh",
        "BD",
        "onsite",
    )
    assert job.deadline is not None and job.deadline.startswith("2026-02-01T23:59:59")
    assert job.description == "Selenium Python"
    assert fetched == ["https://bs23.easy.jobs/api/career/job/sqa-engineer-abc"]


def test_board_responses_that_are_not_json_fail_the_check() -> None:
    for connector in (LeverConnector(), AshbyConnector(), WorkableConnector(), SmartRecruitersConnector(), EasyJobsConnector()):
        with pytest.raises(FetchError, match="invalid_board"):
            connector.parse("<html></html>", definition(connector.key))


def test_html_pages_with_structured_postings_use_them() -> None:
    [job] = HtmlConnector().parse(POSTING_PAGE, definition("html", "https://acme.example.org/careers")).listings
    assert (job.title, job.organization, job.location, job.country_code, job.work_arrangement) == (
        "Data Analyst",
        "Acme Analytics",
        "Dhaka, BD",
        "BD",
        "remote",
    )
    assert job.description == "SQL and dashboards"
    assert job.deadline is not None and job.deadline.startswith("2026-03-01")


def test_html_pages_list_job_links_and_enrich_the_first_ones() -> None:
    pages = {"https://acme.example.org/jobs/backend-engineer-12": POSTING_PAGE}
    connector = HtmlConnector(lambda url: pages[url], max_details=1)
    feed = connector.parse(LISTED_PAGE, definition("html", "https://acme.example.org/careers"))
    assert [(j.title, j.url) for j in feed.listings] == [
        ("Backend Engineer", "https://acme.example.org/jobs/backend-engineer-12"),
        ("Frontend Engineer", "https://acme.example.org/jobs/frontend-engineer-13"),
    ]
    first, second = feed.listings
    assert (first.description, first.work_arrangement) == ("SQL and dashboards", "remote")
    assert (second.organization, second.description) == ("Acme", "")


def test_job_pages_without_structured_data_give_their_description_text() -> None:
    microdata = '<div itemscope><span itemprop="description"><p>Lead <b>solutions</b></p><script>x()</script></span><p>Footer</p></div>'
    article = "<nav>Menu</nav><article><h1>Role</h1><p>Send your CV to jobs@acme.example.org</p></article>"
    pages = {
        "https://acme.example.org/jobs/backend-engineer-12": microdata,
        "https://acme.example.org/jobs/frontend-engineer-13": article,
    }
    feed = HtmlConnector(lambda url: pages[url], max_details=2).parse(LISTED_PAGE, definition("html", "https://acme.example.org/careers"))
    assert [j.description for j in feed.listings] == ["Lead solutions", "Role Send your CV to jobs@acme.example.org"]


def test_json_job_apis_are_read_from_their_job_list() -> None:
    settings = sample_settings().discovery
    body = json.dumps(
        {
            "meta": {"total": 2},
            "data": [
                {
                    "job_category": "Cabin Crew",
                    "deadline": "30 October, 2026",
                    "location": {"name": "Dhaka"},
                    "job_details_page": {"details": ["Fluent English"], "apply_link": "https://portal.example.org/jobs/6/apply"},
                },
                {"job_category": "Pilot", "deadline": "soon", "job_details_page": {"apply_link": "/jobs/7/apply"}},
                {"job_category": "No link"},
            ],
        }
    )
    feed = JsonJobsConnector(settings.json_fields, settings.date_formats).parse(
        body, definition("json", "https://air.example.org/api/jobs")
    )
    first, second = feed.listings
    assert feed.skipped == 1
    assert (first.title, first.url, first.location, first.description) == (
        "Cabin Crew",
        "https://portal.example.org/jobs/6/apply",
        "Dhaka",
        "Fluent English",
    )
    assert first.deadline is not None and first.deadline.startswith("2026-10-30T23:59:59")
    assert (second.url, second.deadline) == ("https://air.example.org/jobs/7/apply", None)
