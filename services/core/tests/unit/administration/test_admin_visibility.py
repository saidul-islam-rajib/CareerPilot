import pytest
from fastapi.testclient import TestClient

from careerpilot.administration.context import AdminActor, PageRequest
from careerpilot.administration.discovery_sync import live_opportunities
from careerpilot.administration.models import AdminOpportunityRow
from careerpilot.api.admin_app import create_admin_app
from careerpilot.automation.models import AutomationRule
from careerpilot.bootstrap import Container
from careerpilot.candidate.models import Contact, UserSummary
from careerpilot.candidate.ports import Account
from careerpilot.discovery.models import Listing, ListingSource
from careerpilot.messaging.service import Sender
from careerpilot.platform.enums import ContactKind, MemberType, OpportunityStatus, UserAccountStatus, UserSegment
from careerpilot.platform.errors import DomainError, ErrorCode
from tests.unit.conftest import CLIENT, DEMO_USER

PASSWORD = "admin@sober.com"
ALL = PageRequest(page_size=500)
NEWCOMER = "usr_newcomer"
PHONE = "+880 1711-223344"


def admin(container: Container) -> AdminActor:
    return container.admin_auth.authenticate(container.admin_auth.sign_in(PASSWORD, PASSWORD, CLIENT.ip).access_token)


def link(key: str, name: str) -> str:
    return f"https://files.example.org/{key}?name={name}"


def add_account(container: Container, user_id: str, name: str, *, phone: str = "", consent_at: str | None = None) -> None:
    candidate = container.messaging._candidate  # pyright: ignore[reportPrivateUsage]
    candidate.accounts.add(
        Account(
            user=UserSummary(id=user_id, full_name=name, email=f"{user_id}@example.org"),
            password_hash="x",
            status=UserAccountStatus.ACTIVE,
            consent_at=consent_at,
        )
    )
    workspace = candidate.workspaces.get(user_id)
    workspace.profile.full_name = name
    if phone:
        workspace.profile.contacts = [
            Contact(id=f"c_{user_id}", kind=ContactKind.PHONE, value=phone, label="Mobile", is_primary=True, verified=True, position=1)
        ]
    candidate.workspaces.save(user_id, workspace)


def listing(listing_id: str) -> Listing:
    return Listing(
        id=listing_id,
        fingerprint=listing_id,
        type="job",
        title=f"Role {listing_id}",
        organization="Acme",
        location="Dhaka",
        country_code="BD",
        work_arrangement="onsite",
        description="",
        status=OpportunityStatus.ACTIVE,
        warnings=[],
        sources=[
            ListingSource(
                source_id="src", url="https://example.org", first_seen_at="2026-01-01T00:00:00Z", last_seen_at="2026-01-01T00:00:00Z"
            )
        ],
        versions=[],
        discovered_at="2026-01-01T00:00:00Z",
        last_checked_at="2026-01-01T00:00:00Z",
    )


def test_dashboard_users_count_every_real_account_even_without_a_directory_row(container: Container) -> None:
    before = container.admin_dashboard.get(admin(container)).users
    add_account(container, NEWCOMER, "Newcomer Person")
    after = container.admin_dashboard.get(admin(container)).users
    assert after.total == before.total + 1
    assert after.total == len(container.admin_users.list(admin(container), ALL).items)
    assert after.active == before.active + 1


def test_dashboard_applications_equal_the_real_applications_of_every_workspace(container: Container) -> None:
    dashboard = container.admin_dashboard.get(admin(container)).applications
    rows = container.user_records.application_rows()
    assert dashboard.total == len(rows)
    assert dashboard.total >= len(container.user_records.applied_opportunity_ids())
    assert sum(item.count for item in dashboard.by_submission_status) == dashboard.total
    assert sum(item.count for item in dashboard.by_outcome_status) == dashboard.total


def test_an_account_without_a_creation_date_does_not_break_the_dashboard_or_the_list(container: Container) -> None:
    add_account(container, NEWCOMER, "Dateless Person", consent_at=None)
    dashboard = container.admin_dashboard.get(admin(container))
    rows = container.admin_users.list(admin(container), PageRequest(page_size=500, segment=UserSegment.NEW)).items
    assert dashboard.users.total >= 1
    assert NEWCOMER not in {row.id for row in rows}


def test_users_list_shows_the_phone_and_is_searchable_by_it(container: Container) -> None:
    add_account(container, NEWCOMER, "Phone Person", phone=PHONE)
    rows = container.admin_users.list(admin(container), PageRequest(page_size=500, search="1711-223344")).items
    assert [(row.id, row.phone) for row in rows] == [(NEWCOMER, PHONE)]


def test_user_detail_phone_comes_from_the_profile_contacts(container: Container) -> None:
    add_account(container, NEWCOMER, "Phone Person", phone=PHONE)
    assert container.admin_users.get(admin(container), NEWCOMER).phone == PHONE


def test_segments_filter_users_the_way_the_dashboard_counts_them(container: Container) -> None:
    dashboard = container.admin_dashboard.get(admin(container)).users
    automatic = container.admin_users.list(admin(container), PageRequest(page_size=500, segment=UserSegment.AUTOMATIC)).items
    incomplete = container.admin_users.list(admin(container), PageRequest(page_size=500, segment=UserSegment.INCOMPLETE)).items
    fresh = container.admin_users.list(admin(container), PageRequest(page_size=500, segment=UserSegment.NEW)).items
    assert (len(automatic), len(incomplete), len(fresh)) == (
        dashboard.automatic_enabled,
        dashboard.incomplete_profiles,
        dashboard.new_this_week,
    )


def test_opportunities_come_from_discovered_listings_with_admin_decisions_kept(container: Container) -> None:
    directory = container.admin_catalog._ctx.directory  # pyright: ignore[reportPrivateUsage]
    flagged = AdminOpportunityRow(
        id="lst_a",
        title="Role lst_a",
        organization="Acme",
        country_code="BD",
        type="job",
        status=OpportunityStatus.FLAGGED,
        discovered_at="",
        applications_count=0,
    )
    directory.save_opportunity(flagged)
    rows = live_opportunities(directory, lambda: [listing("lst_a"), listing("lst_b")], {"lst_b": 2})
    by_id = {row.id: row for row in rows if row.id in {"lst_a", "lst_b"}}
    assert by_id["lst_a"].status is OpportunityStatus.FLAGGED
    assert by_id["lst_b"].status is OpportunityStatus.ACTIVE
    assert by_id["lst_b"].applications_count == 2


def test_a_member_message_is_unread_for_the_team_until_an_admin_opens_it(container: Container) -> None:
    actor = admin(container)
    assert container.admin_messages.unread(actor).count == 0
    team = container.messaging.team(DEMO_USER)
    member = Sender(id=DEMO_USER, type=MemberType.USER, name="Demo")
    container.messaging.send(member, team.id, "Need help with my CV", None, link)
    container.messaging.send(member, team.id, "Anyone there?", None, link)
    assert container.admin_messages.unread(actor).count == 2
    assert container.admin_dashboard.get(actor).unread_messages == 2
    [row] = container.admin_messages.inbox(actor, "", link)
    assert (row.other_member_id, row.unread_count, row.last_message_preview) == (DEMO_USER, 2, "Anyone there?")
    container.admin_messages.team_page(actor, DEMO_USER, None, link)
    assert container.admin_messages.unread(actor).count == 0
    assert container.admin_messages.inbox(actor, "", link)[0].unread_count == 0


def test_the_inbox_lists_each_member_and_is_searchable_by_name_and_text(container: Container) -> None:
    add_account(container, NEWCOMER, "Newcomer Person")
    actor = admin(container)
    first = Sender(id=DEMO_USER, type=MemberType.USER, name="Demo")
    second = Sender(id=NEWCOMER, type=MemberType.USER, name="Newcomer Person")
    container.messaging.send(first, container.messaging.team(DEMO_USER).id, "older note", None, link)
    container.messaging.send(second, container.messaging.team(NEWCOMER).id, "fresh question about visas", None, link)
    ids = [row.other_member_id for row in container.admin_messages.inbox(actor, "", link)]
    assert set(ids) == {DEMO_USER, NEWCOMER}
    assert [row.other_member_id for row in container.admin_messages.inbox(actor, "visas", link)] == [NEWCOMER]
    assert [row.other_member_id for row in container.admin_messages.inbox(actor, "newcomer", link)] == [NEWCOMER]


def test_overview_lists_the_other_records_and_never_a_secret(container: Container) -> None:
    actor = admin(container)
    team = container.messaging.team(DEMO_USER)
    container.messaging.send(Sender(id="adm", type=MemberType.TEAM, name="Team"), team.id, "Welcome", None, link)
    overview = container.admin_overview.get(actor, DEMO_USER)
    assert overview.unread_notifications == len([n for n in overview.notifications if not n.read])
    assert any(n.title for n in overview.notifications)
    assert overview.deletion is None
    dumped = overview.model_dump_json()
    assert "sealed" not in dumped and "password" not in dumped.lower()
    actions = [e.action for e in container.admin_audit.list(actor, PageRequest(page_size=50)).items]
    assert "user.overview_viewed" in actions


def test_overview_of_an_unknown_user_is_not_found(container: Container) -> None:
    with pytest.raises(DomainError) as raised:
        container.admin_overview.get(admin(container), "usr_missing")
    assert raised.value.code is ErrorCode.NOT_FOUND


def test_inbox_endpoints_answer_admins_only(container: Container) -> None:
    client = TestClient(create_admin_app(container))
    assert client.get("/admin/v1/messages/unread").status_code == 401
    token = client.post("/admin/v1/auth/sign-in", json={"email": PASSWORD, "password": PASSWORD}).json()["accessToken"]
    headers = {"Authorization": f"Bearer {token}"}
    assert client.get("/admin/v1/messages/unread", headers=headers).json() == {"count": 0}
    assert client.get("/admin/v1/messages/inbox?q=x", headers=headers).json() == []
    assert client.get(f"/admin/v1/users/{DEMO_USER}/overview", headers=headers).status_code == 200


def test_overview_includes_the_automation_rules_of_the_user(container: Container) -> None:
    candidate = container.messaging._candidate  # pyright: ignore[reportPrivateUsage]
    workspace = candidate.workspaces.get(DEMO_USER)
    stamp = "2026-10-20T06:00:00Z"
    workspace.preferences.automation.rules.append(AutomationRule(id="rule_test", name="Dhaka roles", created_at=stamp, updated_at=stamp))
    candidate.workspaces.save(DEMO_USER, workspace)
    overview = container.admin_overview.get(admin(container), DEMO_USER)
    assert [rule.name for rule in overview.automation_rules] == ["Dhaka roles"]
