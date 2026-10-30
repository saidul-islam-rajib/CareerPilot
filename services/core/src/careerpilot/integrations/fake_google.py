from dataclasses import dataclass, field

from careerpilot.integrations.models import CalendarEventDraft, GoogleTokens, MailMessage
from careerpilot.integrations.ports import GoogleError
from careerpilot.platform.enums import SyncFailure

FAKE_EXPIRES_IN = 3600


@dataclass
class FakeGoogleGateway:
    email: str = "member@gmail.com"
    scopes: list[str] = field(default_factory=list[str])
    messages: dict[str, MailMessage] = field(default_factory=dict[str, MailMessage])
    events: dict[str, CalendarEventDraft] = field(default_factory=dict[str, CalendarEventDraft])
    revoked: list[str] = field(default_factory=list[str])
    queries: list[str] = field(default_factory=list[str])
    reads: list[str] = field(default_factory=list[str])
    event_saves: int = 0
    exchange_failure: SyncFailure | None = None
    refresh_failure: SyncFailure | None = None
    revoke_failure: SyncFailure | None = None
    mail_failure: SyncFailure | None = None
    refreshes: int = 0
    issued: int = 0

    def exchange_code(self, code: str, verifier: str, redirect_uri: str) -> GoogleTokens:
        if self.exchange_failure is not None:
            raise GoogleError(self.exchange_failure)
        return self._tokens(f"refresh-{code}")

    def refresh(self, refresh_token: str) -> GoogleTokens:
        self.refreshes += 1
        if self.refresh_failure is not None:
            raise GoogleError(self.refresh_failure)
        return self._tokens(refresh_token)

    def revoke(self, token: str) -> None:
        self.revoked.append(token)
        if self.revoke_failure is not None:
            raise GoogleError(self.revoke_failure)

    def account_email(self, access_token: str) -> str:
        return self.email

    def find_messages(self, access_token: str, query: str, limit: int) -> list[str]:
        self.queries.append(query)
        if self.mail_failure is not None:
            raise GoogleError(self.mail_failure)
        return list(self.messages)[:limit]

    def read_message(self, access_token: str, message_id: str) -> MailMessage | None:
        self.reads.append(message_id)
        return self.messages.get(message_id)

    def save_event(self, access_token: str, event_id: str, draft: CalendarEventDraft) -> None:
        self.event_saves += 1
        self.events[event_id] = draft

    def cancel_event(self, access_token: str, event_id: str) -> None:
        self.events.pop(event_id, None)

    def _tokens(self, refresh: str) -> GoogleTokens:
        self.issued += 1
        return GoogleTokens(f"access-{self.issued}", refresh, FAKE_EXPIRES_IN, list(self.scopes))
