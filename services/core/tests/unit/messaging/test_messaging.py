from datetime import timedelta

import pytest
from fastapi.testclient import TestClient

from careerpilot.administration.context import AdminActor, PageRequest
from careerpilot.api.admin_app import create_admin_app
from careerpilot.api.user_app import create_user_app
from careerpilot.bootstrap import Container
from careerpilot.candidate.models import Contact, UserSummary
from careerpilot.candidate.ports import Account
from careerpilot.candidate.services.profile import Upload
from careerpilot.messaging.service import LinkFactory, NewAttachment, Sender
from careerpilot.platform.clock import FixedClock
from careerpilot.platform.enums import (
    ContactKind,
    MemberType,
    MessageKind,
    MessageState,
    NotificationKind,
    UserAccountStatus,
)
from careerpilot.platform.errors import DomainError, ErrorCode
from tests.unit.conftest import CLIENT, DEMO_USER

PASSWORD = "admin@sober.com"
OTHER = "usr_karim"
QUIET = "usr_hidden"
PNG = b"\x89PNG\r\n\x1a\n" + b"0" * 32
M4A = b"\x00\x00\x00\x20ftypM4A " + b"0" * 32
PDF = b"%PDF-1.4\n" + b"0" * 32


def link(key: str, name: str) -> str:
    return f"https://files.example.org/{key}?name={name}"


LINK: LinkFactory = link


def add_member(container: Container, user_id: str, name: str, email: str, *, phone: str = "", discoverable: bool = True) -> None:
    accounts = container.messaging._candidate.accounts  # pyright: ignore[reportPrivateUsage]
    workspaces = container.messaging._candidate.workspaces  # pyright: ignore[reportPrivateUsage]
    accounts.add(Account(user=UserSummary(id=user_id, full_name=name, email=email), password_hash="x", status=UserAccountStatus.ACTIVE))
    workspace = workspaces.get(user_id)
    workspace.profile.full_name = name
    workspace.profile.headline = "Backend engineer"
    if phone:
        workspace.profile.contacts = [
            Contact(id=f"c_{user_id}", kind=ContactKind.PHONE, value=phone, label="Mobile", is_primary=True, verified=True, position=1)
        ]
    workspace.preferences.discoverable = discoverable
    workspaces.save(user_id, workspace)


@pytest.fixture
def chat(container: Container) -> Container:
    add_member(container, OTHER, "Karim Hasan", "karim@example.org", phone="+880 1711-223344")
    add_member(container, QUIET, "Karim Hidden", "hidden@example.org", discoverable=False)
    return container


def me(container: Container) -> Sender:
    return Sender(id=DEMO_USER, type=MemberType.USER, name="Ayesha Rahman")


def karim() -> Sender:
    return Sender(id=OTHER, type=MemberType.USER, name="Karim Hasan")


def admin(container: Container) -> AdminActor:
    return container.admin_auth.authenticate(container.admin_auth.sign_in(PASSWORD, PASSWORD, CLIENT.ip).access_token)


def test_members_find_each_other_by_name_or_exact_email_and_phone_but_see_no_contact_details(chat: Container) -> None:
    by_name = chat.messaging.directory(DEMO_USER, "karim", LINK)
    assert [card.id for card in by_name] == [OTHER]
    assert set(by_name[0].model_dump(by_alias=True)) == {"id", "name", "headline", "photoUrl"}
    assert [c.id for c in chat.messaging.directory(DEMO_USER, "KARIM@example.org", LINK)] == [OTHER]
    assert [c.id for c in chat.messaging.directory(DEMO_USER, "01711 223344", LINK)] == [OTHER]
    assert chat.messaging.directory(DEMO_USER, "karim@", LINK) == []
    assert chat.messaging.directory(DEMO_USER, "k", LINK) == []
    assert chat.messaging.directory(DEMO_USER, "hidden@example.org", LINK) == []
    assert chat.messaging.directory(DEMO_USER, "ayesha", LINK) == []


def test_a_conversation_shows_sent_delivered_and_read_ticks_and_notifies_once(chat: Container, clock: FixedClock) -> None:
    started = chat.messaging.start(DEMO_USER, OTHER, LINK)
    assert chat.messaging.start(OTHER, DEMO_USER, LINK).id == started.id
    first = chat.messaging.send(me(chat), started.id, "Hello Karim", None, LINK)
    assert (first.from_me, first.state) == (True, MessageState.SENT)
    clock.advance(timedelta(seconds=1))
    chat.messaging.send(me(chat), started.id, "Are you hiring?", None, LINK)
    notifications = chat.notifications.recent(OTHER)
    assert [(n.kind, n.title) for n in notifications] == [(NotificationKind.MESSAGE, "Ayesha Rahman")]
    clock.advance(timedelta(seconds=1))
    inbox = chat.notifications.inbox(OTHER)
    assert (inbox.unread_messages, inbox.unread_notifications) == (2, 1)
    assert chat.messaging.messages(DEMO_USER, started.id, None, LINK).messages[-1].state is MessageState.DELIVERED
    [listed] = chat.messaging.conversations(OTHER, LINK)
    assert (listed.title, listed.unread_count, listed.last_message_preview) == ("Ayesha Rahman", 2, "Are you hiring?")
    clock.advance(timedelta(seconds=1))
    chat.messaging.read(OTHER, started.id)
    assert chat.messaging.messages(DEMO_USER, started.id, None, LINK).messages[-1].state is MessageState.READ
    assert chat.notifications.inbox(OTHER).unread_notifications == 0
    page = chat.messaging.messages(OTHER, started.id, None, LINK)
    assert [(m.text, m.from_me, m.state) for m in page.messages] == [("Hello Karim", False, None), ("Are you hiring?", False, None)]


def test_photos_voice_notes_and_pdfs_are_checked_and_served_by_signed_links(chat: Container) -> None:
    conversation = chat.messaging.start(DEMO_USER, OTHER, LINK)
    sent = [
        chat.messaging.send(me(chat), conversation.id, "", NewAttachment(MessageKind.IMAGE, Upload("photo.png", PNG)), LINK),
        chat.messaging.send(me(chat), conversation.id, "", NewAttachment(MessageKind.VOICE, Upload("voice.m4a", M4A), 12), LINK),
        chat.messaging.send(me(chat), conversation.id, "My CV", NewAttachment(MessageKind.FILE, Upload("cv.pdf", PDF)), LINK),
    ]
    assert [(m.kind, m.attachment.content_type if m.attachment else "") for m in sent] == [
        (MessageKind.IMAGE, "image/png"),
        (MessageKind.VOICE, "audio/mp4"),
        (MessageKind.FILE, "application/pdf"),
    ]
    assert sent[1].attachment is not None and sent[1].attachment.duration_seconds == 12
    assert sent[2].attachment is not None and sent[2].attachment.url.startswith("https://files.example.org/chat/")
    assert chat.messaging.conversations(OTHER, LINK)[0].last_message_preview == "cv.pdf"
    failures = [
        NewAttachment(MessageKind.IMAGE, Upload("fake.png", PDF)),
        NewAttachment(MessageKind.VOICE, Upload("long.m4a", M4A), 10_000),
        NewAttachment(MessageKind.FILE, Upload("big.pdf", PDF + b"0" * chat.settings.messaging.attachments["file"].max_bytes)),
    ]
    details = []
    for attachment in failures:
        with pytest.raises(DomainError) as raised:
            chat.messaging.send(me(chat), conversation.id, "", attachment, LINK)
        details.append(raised.value.detail)
    assert details == ["file_type", "voice_too_long", "file_too_large"]
    with pytest.raises(DomainError):
        chat.messaging.send(me(chat), conversation.id, "   ", None, LINK)


def test_blocking_stops_messages_both_ways_and_hides_members_from_search(chat: Container) -> None:
    conversation = chat.messaging.start(DEMO_USER, OTHER, LINK)
    chat.messaging.block(OTHER, DEMO_USER, blocked=True)
    for sender in (me(chat), karim()):
        with pytest.raises(DomainError) as raised:
            chat.messaging.send(sender, conversation.id, "Hi", None, LINK)
        assert (raised.value.code, raised.value.detail) == (ErrorCode.FORBIDDEN, "member_blocked")
    assert chat.messaging.directory(DEMO_USER, "karim", LINK) == []
    chat.messaging.block(OTHER, DEMO_USER, blocked=False)
    assert chat.messaging.send(me(chat), conversation.id, "Hi again", None, LINK).text == "Hi again"


def test_muted_conversations_send_no_notifications_and_do_not_count_as_unread(chat: Container) -> None:
    conversation = chat.messaging.start(DEMO_USER, OTHER, LINK)
    chat.messaging.mute(OTHER, conversation.id, muted=True)
    chat.messaging.send(me(chat), conversation.id, "Quiet please", None, LINK)
    assert chat.notifications.recent(OTHER) == []
    assert chat.notifications.inbox(OTHER).unread_messages == 0


def test_the_team_messages_a_member_who_replies_and_admins_see_connections(chat: Container) -> None:
    actor = admin(chat)
    chat.admin_messages.send(actor, DEMO_USER, "Your CV looks great", None, LINK)
    [note] = chat.notifications.recent(DEMO_USER)
    assert (note.kind, note.title) == (NotificationKind.TEAM_MESSAGE, "CareerPilot team")
    [team] = chat.messaging.conversations(DEMO_USER, LINK)
    assert (team.title, team.unread_count) == ("CareerPilot team", 1)
    chat.messaging.send(me(chat), team.id, "Thank you!", None, LINK)
    page = chat.admin_messages.team_page(actor, DEMO_USER, None, LINK)
    assert [(m.text, m.from_me) for m in page.messages] == [("Your CV looks great", True), ("Thank you!", False)]
    assert chat.messaging.messages(DEMO_USER, team.id, None, LINK).messages[-1].state is MessageState.READ
    direct = chat.messaging.start(DEMO_USER, OTHER, LINK)
    chat.messaging.send(me(chat), direct.id, "Hello", None, LINK)
    [connection] = chat.admin_messages.connections(actor, DEMO_USER, LINK)
    assert (connection.member.name, connection.messages) == ("Karim Hasan", 1)
    viewed = chat.admin_messages.conversation(actor, connection.conversation_id, None, LINK)
    assert [m.text for m in viewed.messages] == ["Hello"]
    actions = [e.action for e in chat.admin_audit.list(actor, PageRequest(page_size=50)).items]
    assert "chat.viewed" in actions and "chat.team_message" in actions


def test_admins_see_every_contact_and_document_of_a_member(chat: Container) -> None:
    files = chat.admin_messages.files(admin(chat), DEMO_USER, LINK)
    assert files.documents and all(d.url.startswith("https://files.example.org/") for d in files.documents)
    assert files.contacts and all(c.value for c in files.contacts)


def test_messaging_endpoints(chat: Container) -> None:
    client = TestClient(create_user_app(chat))
    token = client.post("/v1/auth/sign-in", json={"email": PASSWORD, "password": PASSWORD}).json()["accessToken"]
    headers = {"Authorization": f"Bearer {token}"}
    assert client.get("/v1/members", params={"query": "karim"}, headers=headers).json()[0]["id"] == OTHER
    conversation = client.post("/v1/conversations", json={"memberId": OTHER}, headers=headers).json()
    sent = client.post(f"/v1/conversations/{conversation['id']}/messages", json={"text": "Hi"}, headers=headers)
    assert sent.status_code == 200 and sent.json()["state"] == "sent"
    files = {"file": ("note.m4a", M4A, "audio/mp4")}
    voice = client.post(
        f"/v1/conversations/{conversation['id']}/attachments", files=files, data={"kind": "voice", "durationSeconds": "4"}, headers=headers
    )
    assert voice.status_code == 200 and voice.json()["attachment"]["durationSeconds"] == 4
    page = client.get(f"/v1/conversations/{conversation['id']}/messages", headers=headers).json()
    assert [m["kind"] for m in page["messages"]] == ["text", "voice"]
    assert client.get(voice.json()["attachment"]["url"].replace("http://testserver", "")).content == M4A
    assert client.get("/v1/inbox", headers=headers).json()["unreadMessages"] == 0
    assert client.post(f"/v1/conversations/{conversation['id']}/read", headers=headers).status_code == 204
    assert client.put("/v1/settings/discoverable", json={"value": False}, headers=headers).status_code == 204
    assert client.put(f"/v1/members/{OTHER}/block", json={"value": True}, headers=headers).status_code == 204
    assert client.get("/v1/notifications", headers=headers).status_code == 200
    assert client.post("/v1/notifications/read", json={}, headers=headers).status_code == 204
    admin_client = TestClient(create_admin_app(chat))
    admin_token = admin_client.post("/admin/v1/auth/sign-in", json={"email": PASSWORD, "password": PASSWORD}).json()["accessToken"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    assert admin_client.post(f"/admin/v1/users/{DEMO_USER}/messages", json={"text": "Hello"}, headers=admin_headers).status_code == 200
    assert admin_client.get(f"/admin/v1/users/{DEMO_USER}/messages", headers=admin_headers).json()["messages"][-1]["text"] == "Hello"
    assert admin_client.get(f"/admin/v1/users/{DEMO_USER}/connections", headers=admin_headers).json()[0]["member"]["id"] == OTHER
    document = admin_client.get(f"/admin/v1/users/{DEMO_USER}/files", headers=admin_headers).json()["documents"][0]
    assert admin_client.get(document["url"].replace("http://testserver", "")).status_code == 200
