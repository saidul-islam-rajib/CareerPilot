from typing import Protocol

from careerpilot.integrations.models import (
    CalendarEventDraft,
    CalendarEventRecord,
    Classification,
    ConnectionRecord,
    GoogleTokens,
    MailMessage,
    SyncedMessage,
)
from careerpilot.platform.enums import IntegrationProvider, SyncFailure


class GoogleError(Exception):
    def __init__(self, failure: SyncFailure) -> None:
        super().__init__(failure.value)
        self.failure = failure


class GoogleGateway(Protocol):
    def exchange_code(self, code: str, verifier: str, redirect_uri: str) -> GoogleTokens: ...

    def refresh(self, refresh_token: str) -> GoogleTokens: ...

    def revoke(self, token: str) -> None: ...

    def account_email(self, access_token: str) -> str: ...

    def find_messages(self, access_token: str, query: str, limit: int) -> list[str]: ...

    def read_message(self, access_token: str, message_id: str) -> MailMessage | None: ...

    def save_event(self, access_token: str, event_id: str, draft: CalendarEventDraft) -> None: ...

    def cancel_event(self, access_token: str, event_id: str) -> None: ...


class TokenCipher(Protocol):
    def seal(self, plain: str) -> str: ...

    def unseal(self, sealed: str) -> str: ...


class ReplyClassifier(Protocol):
    def classify(self, subject: str, body: str) -> Classification: ...


class ConnectionRepository(Protocol):
    def active(self, user_id: str, provider: IntegrationProvider) -> ConnectionRecord | None: ...

    def save(self, record: ConnectionRecord) -> None: ...

    def remove(self, user_id: str, provider: IntegrationProvider, reason: str) -> None: ...

    def all_active(self, provider: IntegrationProvider) -> list[ConnectionRecord]: ...


class SyncedMessageRepository(Protocol):
    def seen(self, user_id: str, message_id: str) -> bool: ...

    def add(self, message: SyncedMessage) -> None: ...

    def for_application(self, user_id: str, application_id: str) -> list[SyncedMessage]: ...


class CalendarEventRepository(Protocol):
    def get(self, user_id: str, task_id: str) -> CalendarEventRecord | None: ...

    def save(self, record: CalendarEventRecord) -> None: ...
