from fastapi.testclient import TestClient

from careerpilot.administration.context import PageRequest
from careerpilot.administration.models import AdminSourceRow, NewSource, NewUserSource, SourceDecision
from careerpilot.administration.sources import listing_visibility, same_address
from careerpilot.api.admin_app import create_admin_app
from careerpilot.api.user_app import create_user_app
from careerpilot.bootstrap import Container
from careerpilot.discovery.models import Listing, ListingSource
from careerpilot.platform.enums import OpportunityStatus, SourceReview, SourceStatus
from careerpilot.platform.errors import ErrorCode
from tests.unit.administration.conftest import ACME_HOME, LEVER_API, LEVER_BODY, PASSWORD, SITE, FakeSite, actor, failure
from tests.unit.conftest import DEMO_USER

OTHER_USER = "usr_other"
SIGN_IN_EMAIL = "admin@sober.com"
ACME = NewUserSource(url="acme.example.org", note="Local employer hiring engineers")
SEEN_AT = "2026-10-20T06:00:00.000Z"


def acme_site(site: FakeSite) -> None:
    site.pages.update({SITE: ACME_HOME, LEVER_API: LEVER_BODY})


def decision(review: SourceReview, note: str) -> SourceDecision:
    return SourceDecision(review=review, note=note)


def listing_from(source_id: str) -> Listing:
    return Listing(
        id="opp_1",
        fingerprint="acme-backend",
        type="job",
        title="Backend Engineer",
        organization="Acme",
        location="",
        country_code="",
        work_arrangement="not_stated",
        description="",
        status=OpportunityStatus.ACTIVE,
        warnings=[],
        versions=[],
        sources=[ListingSource(source_id=source_id, url="https://jobs.lever.co/acme/1", first_seen_at=SEEN_AT, last_seen_at=SEEN_AT)],
        discovered_at=SEEN_AT,
        last_checked_at=SEEN_AT,
    )


def private_row(review: SourceReview) -> AdminSourceRow:
    return AdminSourceRow(
        id="src_mine",
        name="Acme",
        status=SourceStatus.HEALTHY,
        enabled=True,
        failuresLast24h=0,
        opportunities_found=1,
        review=review,
        owner_ids=[DEMO_USER],
    )


def test_a_user_adds_a_source_by_link_and_it_waits_for_review(app: Container, site: FakeSite) -> None:
    acme_site(site)
    added = app.user_sources.add(DEMO_USER, ACME)
    assert (added.name, added.site_url, added.review, added.status, added.jobs_found) == (
        "Acme",
        SITE,
        SourceReview.PENDING,
        SourceStatus.HEALTHY,
        2,
    )
    assert [s.id for s in app.user_sources.mine(DEMO_USER)] == [added.id]
    [request] = app.admin_catalog.source_requests(actor(app))
    assert (request.id, request.owner_ids, request.request_note) == (added.id, [DEMO_USER], ACME.note)


def test_jobs_from_a_source_under_review_are_only_for_the_people_who_added_it() -> None:
    rows = [private_row(SourceReview.PENDING)]
    visible = listing_visibility(lambda: rows)
    assert visible(DEMO_USER)(listing_from("src_mine"))
    assert not visible(OTHER_USER)(listing_from("src_mine"))
    assert visible(OTHER_USER)(listing_from("src_shared"))
    rows[0] = private_row(SourceReview.APPROVED)
    assert visible(OTHER_USER)(listing_from("src_mine"))


def test_the_same_site_is_never_added_twice(app: Container, site: FakeSite) -> None:
    acme_site(site)
    added = app.user_sources.add(DEMO_USER, ACME)
    again = NewUserSource(url="https://www.acme.example.org/")
    assert failure(lambda: app.user_sources.add(DEMO_USER, again)) == (ErrorCode.CONFLICT, "source_exists")
    joined = app.user_sources.add(OTHER_USER, NewUserSource(url="https://jobs.lever.co/acme"))
    assert joined.id == added.id
    [request] = app.admin_catalog.source_requests(actor(app))
    assert request.owner_ids == [DEMO_USER, OTHER_USER]
    assert failure(lambda: app.admin_catalog.add_source(actor(app), NewSource(url=SITE))) == (ErrorCode.CONFLICT, "source_pending")


def test_approved_sources_serve_everyone_and_are_not_added_again(app: Container, site: FakeSite) -> None:
    acme_site(site)
    added = app.user_sources.add(DEMO_USER, ACME)
    admin = actor(app)
    assert failure(lambda: app.admin_catalog.review_source(admin, added.id, decision(SourceReview.APPROVED, " "))) == (
        ErrorCode.VALIDATION,
        "text",
    )
    reviewed = app.admin_catalog.review_source(admin, added.id, decision(SourceReview.APPROVED, "Real employer"))
    assert (reviewed.review, reviewed.review_note) == (SourceReview.APPROVED, "Real employer")
    assert app.admin_catalog.source_requests(admin) == []
    assert failure(lambda: app.user_sources.add(OTHER_USER, NewUserSource(url=SITE))) == (ErrorCode.CONFLICT, "source_shared")
    assert failure(lambda: app.admin_catalog.add_source(admin, NewSource(url=SITE))) == (ErrorCode.CONFLICT, "source_exists")
    rejected = decision(SourceReview.REJECTED, "Too late")
    assert failure(lambda: app.admin_catalog.review_source(admin, added.id, rejected)) == (ErrorCode.CONFLICT, "source_reviewed")
    actions = [entry.action for entry in app.admin_audit.list(admin, PageRequest()).items]
    assert actions.index("source.approved") < actions.index("source.requested")


def test_rejected_sources_stay_with_their_owners_and_show_why(app: Container, site: FakeSite) -> None:
    acme_site(site)
    added = app.user_sources.add(DEMO_USER, ACME)
    app.admin_catalog.review_source(actor(app), added.id, decision(SourceReview.REJECTED, "Recruiting agency"))
    [mine] = app.user_sources.mine(DEMO_USER)
    assert (mine.review, mine.review_note) == (SourceReview.REJECTED, "Recruiting agency")


def test_removing_a_source_stops_it_once_nobody_uses_it_and_it_can_come_back(app: Container, site: FakeSite) -> None:
    acme_site(site)
    added = app.user_sources.add(DEMO_USER, ACME)
    app.user_sources.remove(DEMO_USER, added.id)
    assert app.user_sources.mine(DEMO_USER) == []
    assert added.id not in app.source_checks.due_sources()
    assert failure(lambda: app.user_sources.remove(DEMO_USER, added.id))[0] is ErrorCode.NOT_FOUND
    again = app.user_sources.add(DEMO_USER, ACME)
    assert (again.id, again.status) == (added.id, SourceStatus.HEALTHY)
    assert added.id in app.source_checks.due_sources()


def test_sites_without_jobs_are_refused_and_users_have_a_limit(app: Container, site: FakeSite) -> None:
    empty = NewUserSource(url="https://empty.example.org")
    assert failure(lambda: app.user_sources.add(DEMO_USER, empty)) == (ErrorCode.VALIDATION, "jobs_not_found")
    for index in range(app.settings.discovery.max_sources_per_user):
        site.pages[f"https://api.lever.co/v0/postings/team{index}?mode=json"] = LEVER_BODY
        app.user_sources.add(DEMO_USER, NewUserSource(url=f"https://jobs.lever.co/team{index}"))
    acme_site(site)
    assert failure(lambda: app.user_sources.add(DEMO_USER, ACME)) == (ErrorCode.VALIDATION, "source_limit")


def test_addresses_match_without_scheme_www_or_trailing_slash() -> None:
    assert same_address("https://www.acme.example.org/", "http://acme.example.org")
    assert not same_address("https://acme.example.org/jobs", "https://acme.example.org")
    assert not same_address("", "")


def test_source_endpoints(app: Container, site: FakeSite) -> None:
    acme_site(site)
    users = TestClient(create_user_app(app))
    token = users.post("/v1/auth/sign-in", json={"email": SIGN_IN_EMAIL, "password": PASSWORD}).json()["accessToken"]
    headers = {"Authorization": f"Bearer {token}"}
    added = users.post("/v1/sources", headers=headers, json={"url": "acme.example.org", "note": "Hiring in Dhaka"})
    assert added.status_code == 200
    source_id = added.json()["id"]
    assert (added.json()["review"], added.json()["siteUrl"]) == ("pending", SITE)
    admins = TestClient(create_admin_app(app))
    admin_token = admins.post("/admin/v1/auth/sign-in", json={"email": SIGN_IN_EMAIL, "password": PASSWORD}).json()["accessToken"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    assert [r["id"] for r in admins.get("/admin/v1/sources/requests", headers=admin_headers).json()] == [source_id]
    approved = admins.post(
        f"/admin/v1/sources/{source_id}/review", headers=admin_headers, json={"review": "approved", "note": "Real employer"}
    )
    assert approved.json()["review"] == "approved"
    assert [s["review"] for s in users.get("/v1/sources", headers=headers).json()] == ["approved"]
    assert users.delete(f"/v1/sources/{source_id}", headers=headers).status_code == 204
    assert users.get("/v1/sources", headers=headers).json() == []
