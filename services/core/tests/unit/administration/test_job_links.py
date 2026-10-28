from fastapi.testclient import TestClient

from careerpilot.administration.sources import link_source_id, listing_visibility
from careerpilot.api.user_app import create_user_app
from careerpilot.bootstrap import Container
from careerpilot.platform.enums import OpportunityDecision
from careerpilot.platform.errors import ErrorCode
from tests.unit.administration.conftest import PASSWORD, UNSAFE_URL, FakeSite, failure
from tests.unit.conftest import DEMO_USER

JOB_URL = "https://careers.acme.example.org/jobs/backend-engineer"
PLAIN_URL = "https://acme.example.org/vacancy/42"
POSTING_PAGE = """<html><head><title>Backend Engineer | Acme</title>
<script type="application/ld+json">{"@type": "JobPosting", "title": "Backend Engineer",
 "hiringOrganization": {"name": "Acme Ltd"}, "jobLocationType": "TELECOMMUTE",
 "description": "<p>Python and React. Send your CV to jobs@acme.example.org</p>"}</script></head><body></body></html>"""
PLAIN_PAGE = "<html><head><title>QA Engineer - Acme</title></head><body><main><p>Selenium and Python testing.</p></main></body></html>"


def test_a_pasted_job_link_is_read_matched_and_saved_to_a_track(app: Container, site: FakeSite) -> None:
    site.pages[JOB_URL] = POSTING_PAGE
    detail = app.job_links.add(DEMO_USER, JOB_URL)
    assert (detail.title, detail.organization, detail.work_arrangement) == ("Backend Engineer", "Acme Ltd", "remote")
    assert (detail.route, detail.application_email) == ("email", "jobs@acme.example.org")
    assert detail.decision is OpportunityDecision.SAVED
    assert detail.source.name == "Added by you from a link"
    placed = {oid for digest in app.dashboard.get(DEMO_USER).tracks for oid in (o.id for o in digest.opportunities)}
    assert detail.id in placed
    assert app.job_links.add(DEMO_USER, JOB_URL).id == detail.id


def test_pages_without_structured_data_use_the_page_title_and_text(app: Container, site: FakeSite) -> None:
    site.pages[PLAIN_URL] = PLAIN_PAGE
    detail = app.job_links.add(DEMO_USER, "acme.example.org/vacancy/42")
    assert (detail.title, detail.description) == ("QA Engineer", "Selenium and Python testing.")


def test_unreadable_or_unsafe_links_are_refused(app: Container) -> None:
    assert failure(lambda: app.job_links.add(DEMO_USER, "https://gone.example.org/job")) == (ErrorCode.VALIDATION, "job_not_found")
    assert failure(lambda: app.job_links.add(DEMO_USER, UNSAFE_URL)) == (ErrorCode.VALIDATION, "job_url")


def test_jobs_added_by_link_stay_private_to_the_person_who_added_them(app: Container, site: FakeSite) -> None:
    site.pages[JOB_URL] = POSTING_PAGE
    added = app.job_links.add(DEMO_USER, JOB_URL)
    listing = next(item for item in app.discovery.listings() if item.id == added.id)
    assert listing.sources[0].source_id == link_source_id(DEMO_USER)
    visible = listing_visibility(list)
    assert visible(DEMO_USER)(listing)
    assert not visible("usr_other")(listing)


def test_job_link_endpoint(app: Container, site: FakeSite) -> None:
    site.pages[JOB_URL] = POSTING_PAGE
    client = TestClient(create_user_app(app))
    token = client.post("/v1/auth/sign-in", json={"email": "admin@sober.com", "password": PASSWORD}).json()["accessToken"]
    response = client.post("/v1/opportunities/by-link", headers={"Authorization": f"Bearer {token}"}, json={"url": JOB_URL})
    assert response.status_code == 200
    assert response.json()["title"] == "Backend Engineer"
