import base64
import json
from datetime import UTC, datetime
from urllib.parse import parse_qs

import httpx
import pytest

from careerpilot.integrations.google_http import HttpGoogleGateway, parse_sender
from careerpilot.integrations.models import CalendarEventDraft
from careerpilot.integrations.ports import GoogleError
from careerpilot.platform.config import load_settings
from careerpilot.platform.enums import SyncFailure

Handler = httpx.MockTransport


def gateway(handler: object) -> HttpGoogleGateway:
    client = httpx.Client(transport=httpx.MockTransport(handler))  # pyright: ignore[reportArgumentType]
    return HttpGoogleGateway(load_settings("local").integrations.google, lambda: ("the-id", "the-secret"), client)


def encoded(text: str) -> str:
    return base64.urlsafe_b64encode(text.encode()).decode().rstrip("=")


DRAFT = CalendarEventDraft(
    "Title", "Notes", "Office", datetime(2026, 10, 22, 10, 0, tzinfo=UTC), datetime(2026, 10, 22, 11, 0, tzinfo=UTC), "Asia/Dhaka", 30
)


def test_the_code_is_exchanged_with_the_verifier_and_the_scopes_are_read() -> None:
    seen: list[dict[str, list[str]]] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(parse_qs(request.content.decode()))
        return httpx.Response(200, json={"access_token": "a", "refresh_token": "r", "expires_in": 3599, "scope": "openid email"})

    tokens = gateway(handler).exchange_code("the-code", "the-verifier", "http://localhost:8000/cb")
    assert (tokens.access_token, tokens.refresh_token, tokens.expires_in, tokens.scopes) == ("a", "r", 3599, ["openid", "email"])
    assert seen[0]["code_verifier"] == ["the-verifier"] and seen[0]["client_secret"] == ["the-secret"]
    assert seen[0]["grant_type"] == ["authorization_code"]


def test_refresh_keeps_the_old_refresh_token_when_google_sends_none() -> None:
    tokens = gateway(lambda _: httpx.Response(200, json={"access_token": "new", "expires_in": 10})).refresh("old")
    assert (tokens.access_token, tokens.refresh_token) == ("new", "old")


@pytest.mark.parametrize(
    ("response", "failure"),
    [
        (httpx.Response(400, json={"error": "invalid_grant"}), SyncFailure.TOKEN_REVOKED),
        (httpx.Response(401, json={}), SyncFailure.TOKEN_REVOKED),
        (httpx.Response(403, json={"error": "forbidden"}), SyncFailure.GOOGLE_REJECTED),
        (httpx.Response(500, text="down"), SyncFailure.GOOGLE_UNAVAILABLE),
        (httpx.Response(429, text="slow"), SyncFailure.GOOGLE_UNAVAILABLE),
        (httpx.Response(403, text="not json"), SyncFailure.GOOGLE_REJECTED),
    ],
)
def test_google_errors_become_sync_failures(response: httpx.Response, failure: SyncFailure) -> None:
    with pytest.raises(GoogleError) as raised:
        gateway(lambda _: response).refresh("r")
    assert raised.value.failure is failure


def test_a_network_error_is_an_outage() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("down", request=request)

    with pytest.raises(GoogleError) as raised:
        gateway(handler).find_messages("t", "q", 5)
    assert raised.value.failure is SyncFailure.GOOGLE_UNAVAILABLE


def test_messages_are_listed_and_read_as_plain_text() -> None:
    body = {
        "internalDate": "1792476000000",
        "snippet": "snippet",
        "payload": {
            "mimeType": "multipart/alternative",
            "headers": [{"name": "From", "value": '"Bay HR" <HR@Bay.example.com>'}, {"name": "Subject", "value": "Interview"}],
            "parts": [
                {"mimeType": "text/html", "body": {"data": encoded("<p>x</p>")}},
                {"mimeType": "text/plain", "body": {"data": encoded("Plain body")}},
            ],
        },
    }

    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path.endswith("/messages"):
            assert request.headers["authorization"] == "Bearer tok" and request.url.params["q"] == "the query"
            return httpx.Response(200, json={"messages": [{"id": "m1"}, {"id": "m2"}]})
        return httpx.Response(200, json=body)

    google = gateway(handler)
    assert google.find_messages("tok", "the query", 10) == ["m1", "m2"]
    message = google.read_message("tok", "m1")
    assert message is not None
    assert (message.sender_address, message.sender_name, message.subject, message.body) == (
        "hr@bay.example.com",
        "Bay HR",
        "Interview",
        "Plain body",
    )
    assert message.received_at == datetime.fromtimestamp(1792476000, UTC)


def test_a_vanished_message_reads_as_nothing_and_an_empty_search_as_no_ids() -> None:
    assert gateway(lambda _: httpx.Response(404, json={})).read_message("t", "gone") is None
    assert gateway(lambda _: httpx.Response(200, json={})).find_messages("t", "q", 5) == []


def test_a_message_without_plain_text_falls_back_to_the_snippet() -> None:
    payload = {"internalDate": "0", "snippet": "just a snippet", "payload": {"mimeType": "text/html", "headers": []}}
    message = gateway(lambda _: httpx.Response(200, json=payload)).read_message("t", "m")
    assert message is not None and message.body == "just a snippet" and message.sender_address == ""


def test_events_are_inserted_with_a_fixed_id_and_updated_when_it_exists() -> None:
    calls: list[tuple[str, str, dict[str, object]]] = []

    def handler(request: httpx.Request) -> httpx.Response:
        calls.append((request.method, request.url.path, json.loads(request.content)))
        return httpx.Response(409, json={}) if request.method == "POST" else httpx.Response(200, json={"id": "evt"})

    gateway(handler).save_event("tok", "cpabc", DRAFT)
    assert [c[0] for c in calls] == ["POST", "PUT"]
    assert calls[1][1].endswith("/events/cpabc")
    document = calls[0][2]
    assert document["id"] == "cpabc" and document["start"] == {"dateTime": "2026-10-22T10:00:00+00:00", "timeZone": "Asia/Dhaka"}
    assert document["reminders"] == {"useDefault": False, "overrides": [{"method": "popup", "minutes": 30}]}


def test_cancelling_a_missing_event_is_fine_and_revoking_tolerates_a_stale_token() -> None:
    gateway(lambda _: httpx.Response(404, json={})).cancel_event("t", "gone")
    gateway(lambda _: httpx.Response(410, json={})).cancel_event("t", "gone")
    gateway(lambda _: httpx.Response(400, json={"error": "invalid_token"})).revoke("old")


def test_the_account_email_comes_from_the_profile() -> None:
    assert gateway(lambda _: httpx.Response(200, json={"email": "me@gmail.com"})).account_email("t") == "me@gmail.com"
    with pytest.raises(GoogleError):
        gateway(lambda _: httpx.Response(200, json={})).account_email("t")


def test_senders_are_parsed_with_or_without_a_name() -> None:
    assert parse_sender("Name <A@B.com>") == ("a@b.com", "Name")
    assert parse_sender("a@b.com") == ("a@b.com", "")
