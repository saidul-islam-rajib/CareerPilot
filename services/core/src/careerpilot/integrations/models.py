from dataclasses import dataclass, field
from datetime import datetime

from careerpilot.platform.enums import (
    CalendarEventState,
    ConnectionStatus,
    IntegrationProvider,
    ReplyDisposition,
    ReplyKind,
    SyncFailure,
)
from careerpilot.platform.model import CamelModel


class ConnectionRecord(CamelModel):
    id: str
    user_id: str
    provider: IntegrationProvider
    email: str
    status: ConnectionStatus
    scopes: list[str]
    sealed_tokens: str
    access_expires_at: str
    connected_at: str
    last_sync_at: str | None = None
    last_error: SyncFailure | None = None
    attention_notified: bool = False


class ConnectionView(CamelModel):
    provider: IntegrationProvider
    email: str
    status: ConnectionStatus
    scopes: list[str]
    connected_at: str
    last_sync_at: str | None = None
    last_error: SyncFailure | None = None


class IntegrationStatus(CamelModel):
    connected: bool
    configured: bool
    connection: ConnectionView | None = None
    mail_access: bool = False
    calendar_access: bool = False


class AuthorizeUrl(CamelModel):
    url: str


class SyncSummary(CamelModel):
    messages: int
    events: int


class SyncedMessage(CamelModel):
    id: str
    user_id: str
    message_id: str
    application_id: str
    received_at: str
    kind: ReplyKind
    disposition: ReplyDisposition
    confidence: float
    subject: str


class CalendarEventRecord(CamelModel):
    id: str
    user_id: str
    task_id: str
    application_id: str
    event_id: str
    state: CalendarEventState
    fingerprint: str


@dataclass(frozen=True)
class TokenSet:
    access_token: str
    refresh_token: str
    expires_at: str


@dataclass(frozen=True)
class GoogleTokens:
    access_token: str
    refresh_token: str | None
    expires_in: int
    scopes: list[str]


@dataclass(frozen=True)
class MailMessage:
    id: str
    sender_address: str
    sender_name: str
    subject: str
    body: str
    received_at: datetime


@dataclass(frozen=True)
class CalendarEventDraft:
    title: str
    description: str
    location: str
    start: datetime
    end: datetime
    time_zone: str
    reminder_minutes: int


@dataclass(frozen=True)
class Classification:
    kind: ReplyKind
    confidence: float


@dataclass
class Targets:
    addresses: set[str] = field(default_factory=set[str])
    domains: set[str] = field(default_factory=set[str])
    organization: str = ""
