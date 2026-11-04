from datetime import date

import pytest
from fastapi.testclient import TestClient

from careerpilot.bootstrap import Container
from careerpilot.discovery.ports import FetchError
from careerpilot.government.connector import TeletalkReader
from careerpilot.government.models import Circular
from careerpilot.platform.config import GovernmentConfig
from careerpilot.platform.errors import DomainError
from tests.unit.government.conftest import circular, post, publish

ADMIN = "/admin/v1/government"
USER = "/v1/government"
PAGE = """<html><head><title>Recruitment of Office Assistants | Teletalk Alljobs</title></head>
<body><main><h1>Recruitment of Office Assistants</h1>
<p>Last date of application: 15-11-2026 until 5:00 pm.</p>
<p>Application fee: Tk. 112 only, paid by mobile banking.</p></main></body></html>"""


def test_drafts_are_hidden_until_published_and_posts_get_ids(
    admin_client: TestClient, user_client: TestClient, admin_headers: dict[str, str], user_headers: dict[str, str]
) -> None:
    draft = admin_client.post(f"{ADMIN}/circulars", json=circular(), headers=admin_headers).json()
    assert draft["status"] == "draft"
    assert all(p["id"] for p in draft["posts"])
    assert user_client.get(f"{USER}/circulars", headers=user_headers).json() == []
    assert user_client.get(f"{USER}/circulars/{draft['id']}", headers=user_headers).status_code == 404
    admin_client.post(f"{ADMIN}/circulars/{draft['id']}/publish", headers=admin_headers)
    listing = user_client.get(f"{USER}/circulars", headers=user_headers).json()
    assert [(c["title"], c["phase"], c["vacancies"], len(c["posts"])) for c in listing] == [
        ("Recruitment of Assistant Officers", "open", 20, 2)
    ]


def test_a_circular_without_posts_cannot_be_published(admin_client: TestClient, admin_headers: dict[str, str]) -> None:
    draft = admin_client.post(f"{ADMIN}/circulars", json=circular(posts=[]), headers=admin_headers).json()
    refused = admin_client.post(f"{ADMIN}/circulars/{draft['id']}/publish", headers=admin_headers)
    assert refused.status_code == 422


def test_grades_ranges_authority_and_location_filters(
    admin_client: TestClient, user_client: TestClient, admin_headers: dict[str, str], user_headers: dict[str, str]
) -> None:
    publish(admin_client, admin_headers, posts=[post("A", grade=9), post("B", grade=10, location="Sylhet"), post("C", grade=16)])

    def titles(query: str) -> list[str]:
        listing = user_client.get(f"{USER}/circulars?{query}", headers=user_headers).json()
        return [p["title"] for c in listing for p in c["posts"]]

    assert titles("grades=9,10") == ["A", "B"]
    assert titles("gradeMin=10&gradeMax=16") == ["B", "C"]
    assert titles("location=sylhet") == ["B"]
    assert titles("authority=public") == ["A", "B", "C"]
    assert titles("authority=health") == []
    assert titles("phase=closed") == []
    pay = user_client.get(f"{USER}/circulars?grades=9", headers=user_headers).json()[0]["posts"][0]
    assert (pay["payMin"], pay["payMax"]) == (22000, 53060)


def test_an_amendment_of_a_published_circular_makes_a_new_version_and_keeps_the_old_one(
    admin_client: TestClient, user_client: TestClient, admin_headers: dict[str, str], user_headers: dict[str, str]
) -> None:
    created = publish(admin_client, admin_headers)
    posts = created["posts"]
    same = admin_client.put(f"{ADMIN}/circulars/{created['id']}", json=circular(posts=posts), headers=admin_headers).json()
    assert same["version"] == 1
    amended = admin_client.put(
        f"{ADMIN}/circulars/{created['id']}", json=circular(closesOn="2026-11-30", posts=posts), headers=admin_headers
    ).json()
    assert amended["version"] == 2
    assert amended["versions"][-1]["changed"] == ["closes_on"]
    view = user_client.get(f"{USER}/circulars/{created['id']}", headers=user_headers).json()
    assert view["amended"] is True
    old = user_client.get(f"{USER}/circulars/{created['id']}/versions/1", headers=user_headers).json()
    assert old["snapshot"]["closesOn"] == "2026-11-12"
    assert user_client.get(f"{USER}/circulars/{created['id']}/versions/9", headers=user_headers).status_code == 404


def test_notices_and_live_removal_are_recorded_and_withdrawn_circulars_disappear(
    admin_client: TestClient, user_client: TestClient, admin_headers: dict[str, str], user_headers: dict[str, str]
) -> None:
    created = publish(admin_client, admin_headers)
    notice = {"kind": "reschedule", "title": "Written test moved", "url": "https://alljobs.teletalk.com.bd/n/2"}
    with_notice = admin_client.post(f"{ADMIN}/circulars/{created['id']}/notices", json=notice, headers=admin_headers).json()
    assert with_notice["notices"][0]["kind"] == "reschedule"
    removed = admin_client.put(f"{ADMIN}/circulars/{created['id']}/live-removed", json={"removed": True}, headers=admin_headers).json()
    assert removed["liveRemoved"] is True
    assert user_client.get(f"{USER}/circulars/{created['id']}", headers=user_headers).json()["circular"]["liveRemoved"] is True
    admin_client.post(f"{ADMIN}/circulars/{created['id']}/withdraw", headers=admin_headers)
    assert user_client.get(f"{USER}/circulars", headers=user_headers).json() == []


def test_closing_on_a_holiday_is_flagged_with_the_nearest_working_days(
    admin_client: TestClient, user_client: TestClient, admin_headers: dict[str, str], user_headers: dict[str, str]
) -> None:
    added = admin_client.post(f"{ADMIN}/holidays", json={"on": "2026-11-12", "name": "Special holiday"}, headers=admin_headers)
    assert added.status_code == 200
    created = publish(admin_client, admin_headers)
    note = user_client.get(f"{USER}/circulars/{created['id']}", headers=user_headers).json()["closeNote"]
    assert (note["kind"], note["holidayName"]) == ("holiday", "Special holiday")
    assert note["previousWorkingDay"] == "2026-11-11"
    assert note["nextWorkingDay"] == "2026-11-15"
    reference = user_client.get(f"{USER}/reference", headers=user_headers).json()
    assert [h["name"] for h in reference["holidays"]] == ["Special holiday"]
    assert reference["weekendDays"] == ["friday", "saturday"]
    assert admin_client.delete(f"{ADMIN}/holidays/{added.json()['id']}", headers=admin_headers).status_code == 204
    assert admin_client.get(f"{ADMIN}/holidays", headers=admin_headers).json() == []


def test_weekends_recurring_holidays_and_office_hours(container: Container) -> None:
    calendar = container.government.calendar
    assert calendar.day(date(2026, 11, 13)).kind == "weekend"
    assert calendar.day(date(2026, 11, 14)).kind == "weekend"
    assert calendar.day(date(2026, 11, 15)).kind == "working"
    assert calendar.day(date(2027, 3, 26)).name == "Independence Day"
    late = container.government.circulars.close_note(closing("23:30"))
    assert late is not None
    assert late.outside_office_hours is True
    inside = container.government.circulars.close_note(closing("16:59"))
    assert inside is not None
    assert inside.outside_office_hours is False


def closing(closes_time: str) -> Circular:
    return Circular(id="c", authority="A", title="T", closes_on=date(2026, 11, 12), closes_time=closes_time)


def test_a_blank_holiday_name_is_refused(admin_client: TestClient, admin_headers: dict[str, str]) -> None:
    refused = admin_client.post(f"{ADMIN}/holidays", json={"on": "2026-11-12", "name": "   "}, headers=admin_headers)
    assert refused.status_code == 422


def test_read_only_administrators_cannot_change_circulars(admin_client: TestClient) -> None:
    token = admin_client.post("/admin/v1/auth/sign-in", json={"email": "viewer@sober.com", "password": "admin@sober.com"}).json()
    headers = {"Authorization": f"Bearer {token['accessToken']}"}
    assert admin_client.get(f"{ADMIN}/circulars", headers=headers).status_code == 200
    assert admin_client.post(f"{ADMIN}/circulars", json=circular(), headers=headers).status_code == 403
    assert admin_client.post(f"{ADMIN}/holidays", json={"on": "2026-11-12", "name": "X"}, headers=headers).status_code == 403


def reader(container: Container, pages: dict[str, str]) -> TeletalkReader:
    def fetch(url: str) -> tuple[str, str]:
        if url not in pages:
            raise FetchError("unreachable")
        return url, pages[url]

    return TeletalkReader(container.settings.government, fetch)


def test_the_connector_reads_a_public_circular_page_into_a_draft_for_review(container: Container) -> None:
    url = "https://alljobs.teletalk.com.bd/jobs/12"
    draft = reader(container, {url: PAGE}).read(url)
    assert draft.needs_review is True
    assert draft.content.title == "Recruitment of Office Assistants"
    assert draft.content.closes_on == date(2026, 11, 15)
    assert draft.content.fee is not None
    assert draft.content.fee.amount == 112
    assert draft.content.posts == []
    assert draft.content.apply_url == url


def test_the_connector_refuses_other_hosts_and_unreachable_pages(container: Container) -> None:
    source = reader(container, {})
    for url in ("https://example.com/jobs/1", "http://alljobs.teletalk.com.bd/jobs/1", "https://evil.test/alljobs.teletalk.com.bd"):
        with pytest.raises(DomainError) as refused:
            source.read(url)
        assert refused.value.detail == "host_not_allowed"
    with pytest.raises(DomainError) as unreachable:
        source.read("https://alljobs.teletalk.com.bd/jobs/404")
    assert unreachable.value.detail == "unreachable"


def test_admins_import_a_draft_from_a_link_through_the_api(
    container: Container, admin_client: TestClient, admin_headers: dict[str, str]
) -> None:
    config: GovernmentConfig = container.settings.government
    assert config.connector.allowed_hosts == ["alljobs.teletalk.com.bd"]
    refused = admin_client.post(f"{ADMIN}/circulars/import", json={"url": "https://example.com/x"}, headers=admin_headers)
    assert refused.status_code == 422
