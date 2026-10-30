import base64
from collections.abc import Callable
from datetime import UTC, datetime
from http import HTTPStatus
from typing import Any, cast

import httpx

from careerpilot.integrations.models import CalendarEventDraft, GoogleTokens, MailMessage
from careerpilot.integrations.ports import GoogleError
from careerpilot.platform.config import GoogleConfig
from careerpilot.platform.enums import SyncFailure

JsonObject = dict[str, Any]
Credentials = Callable[[], tuple[str, str]]
REVOKED_ERRORS = frozenset({"invalid_grant", "invalid_token", "unauthorized_client"})
HEADERS_PART = "payload"
MESSAGE_FORMAT = "full"
MILLIS = 1000


def parse_sender(value: str) -> tuple[str, str]:
    if "<" in value and value.rstrip().endswith(">"):
        name, _, rest = value.rpartition("<")
        return rest.rstrip().rstrip(">").strip().lower(), name.strip().strip('"')
    return value.strip().lower(), ""


def decode_part(data: str) -> str:
    padded = data + "=" * (-len(data) % 4)
    return base64.urlsafe_b64decode(padded.encode()).decode("utf-8", errors="replace")


def plain_text(part: JsonObject) -> str:
    if str(part.get("mimeType", "")).startswith("text/plain"):
        data = cast("JsonObject", part.get("body") or {}).get("data")
        if isinstance(data, str):
            return decode_part(data)
    for child in cast("list[JsonObject]", part.get("parts") or []):
        found = plain_text(child)
        if found:
            return found
    return ""


def header(headers: list[JsonObject], name: str) -> str:
    return next((str(h.get("value", "")) for h in headers if str(h.get("name", "")).lower() == name), "")


class HttpGoogleGateway:
    def __init__(self, config: GoogleConfig, credentials: Credentials, client: httpx.Client | None = None) -> None:
        self._config = config
        self._credentials = credentials
        self._client = client or httpx.Client(timeout=config.timeout_seconds)

    def exchange_code(self, code: str, verifier: str, redirect_uri: str) -> GoogleTokens:
        client_id, secret = self._credentials()
        form = {
            "grant_type": "authorization_code",
            "code": code,
            "code_verifier": verifier,
            "redirect_uri": redirect_uri,
            "client_id": client_id,
            "client_secret": secret,
        }
        return self._tokens(self._send("POST", str(self._config.token_endpoint), data=form))

    def refresh(self, refresh_token: str) -> GoogleTokens:
        client_id, secret = self._credentials()
        form = {"grant_type": "refresh_token", "refresh_token": refresh_token, "client_id": client_id, "client_secret": secret}
        tokens = self._tokens(self._send("POST", str(self._config.token_endpoint), data=form))
        return GoogleTokens(tokens.access_token, tokens.refresh_token or refresh_token, tokens.expires_in, tokens.scopes)

    def revoke(self, token: str) -> None:
        self._send("POST", str(self._config.revoke_endpoint), data={"token": token}, allow=frozenset({HTTPStatus.BAD_REQUEST}))

    def account_email(self, access_token: str) -> str:
        body = self._send("GET", str(self._config.userinfo_endpoint), token=access_token)
        email = body.get("email")
        if not isinstance(email, str) or not email:
            raise GoogleError(SyncFailure.GOOGLE_REJECTED)
        return email

    def find_messages(self, access_token: str, query: str, limit: int) -> list[str]:
        body = self._send("GET", f"{self._config.gmail_base_url}/messages", token=access_token, params={"q": query, "maxResults": limit})
        return [str(item["id"]) for item in cast("list[JsonObject]", body.get("messages") or [])]

    def read_message(self, access_token: str, message_id: str) -> MailMessage | None:
        url = f"{self._config.gmail_base_url}/messages/{message_id}"
        body = self._send("GET", url, token=access_token, params={"format": MESSAGE_FORMAT}, allow=frozenset({HTTPStatus.NOT_FOUND}))
        if not body:
            return None
        payload = cast("JsonObject", body.get(HEADERS_PART) or {})
        headers = cast("list[JsonObject]", payload.get("headers") or [])
        address, name = parse_sender(header(headers, "from"))
        return MailMessage(
            id=message_id,
            sender_address=address,
            sender_name=name,
            subject=header(headers, "subject"),
            body=plain_text(payload) or str(body.get("snippet", "")),
            received_at=self._received(body),
        )

    def save_event(self, access_token: str, event_id: str, draft: CalendarEventDraft) -> None:
        base = f"{self._config.calendar_base_url}/events"
        document = self._event_document(event_id, draft)
        created = self._send("POST", base, token=access_token, json=document, allow=frozenset({HTTPStatus.CONFLICT}))
        if not created:
            self._send("PUT", f"{base}/{event_id}", token=access_token, json=document)

    def cancel_event(self, access_token: str, event_id: str) -> None:
        url = f"{self._config.calendar_base_url}/events/{event_id}"
        self._send("DELETE", url, token=access_token, allow=frozenset({HTTPStatus.NOT_FOUND, HTTPStatus.GONE}))

    @staticmethod
    def _received(body: JsonObject) -> datetime:
        return datetime.fromtimestamp(int(body.get("internalDate", 0)) / MILLIS, UTC)

    @staticmethod
    def _event_document(event_id: str, draft: CalendarEventDraft) -> JsonObject:
        return {
            "id": event_id,
            "status": "confirmed",
            "summary": draft.title,
            "description": draft.description,
            "location": draft.location,
            "start": {"dateTime": draft.start.isoformat(), "timeZone": draft.time_zone},
            "end": {"dateTime": draft.end.isoformat(), "timeZone": draft.time_zone},
            "reminders": {"useDefault": False, "overrides": [{"method": "popup", "minutes": draft.reminder_minutes}]},
        }

    @staticmethod
    def _tokens(body: JsonObject) -> GoogleTokens:
        access = body.get("access_token")
        if not isinstance(access, str):
            raise GoogleError(SyncFailure.GOOGLE_REJECTED)
        refresh = body.get("refresh_token")
        return GoogleTokens(
            access_token=access,
            refresh_token=refresh if isinstance(refresh, str) else None,
            expires_in=int(body.get("expires_in", 0)),
            scopes=str(body.get("scope", "")).split(),
        )

    def _send(
        self,
        method: str,
        url: str,
        *,
        token: str | None = None,
        allow: frozenset[HTTPStatus] = frozenset(),
        **options: Any,
    ) -> JsonObject:
        headers = {"Authorization": f"Bearer {token}"} if token else {}
        try:
            response = self._client.request(method, url, headers=headers, **options)
        except httpx.HTTPError as error:
            raise GoogleError(SyncFailure.GOOGLE_UNAVAILABLE) from error
        if response.status_code in allow:
            return {}
        if response.is_success:
            return cast("JsonObject", response.json()) if response.content else {}
        raise GoogleError(self._failure(response))

    @staticmethod
    def _failure(response: httpx.Response) -> SyncFailure:
        if response.status_code >= HTTPStatus.INTERNAL_SERVER_ERROR or response.status_code == HTTPStatus.TOO_MANY_REQUESTS:
            return SyncFailure.GOOGLE_UNAVAILABLE
        try:
            code = str(cast("JsonObject", response.json()).get("error", ""))
        except ValueError:
            code = ""
        if code in REVOKED_ERRORS or response.status_code == HTTPStatus.UNAUTHORIZED:
            return SyncFailure.TOKEN_REVOKED
        return SyncFailure.GOOGLE_REJECTED
