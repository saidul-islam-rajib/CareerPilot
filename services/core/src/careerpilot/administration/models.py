from typing import Generic, TypeVar

from pydantic import Field

from careerpilot.candidate.models import SignInEvent, Track
from careerpilot.platform.enums import (
    ActorType,
    AdminArea,
    AdminRole,
    ApplicationMode,
    EmergencyStopScope,
    OpportunityStatus,
    OpportunityType,
    OutcomeStatus,
    PermissionAction,
    SourceStatus,
    SubmissionStatus,
    ThemeKey,
    UserAccountStatus,
    WorkArrangement,
)
from careerpilot.platform.model import CamelModel


class AdminSummary(CamelModel):
    id: str
    full_name: str
    email: str
    role: AdminRole


class AdminPermission(CamelModel):
    area: AdminArea
    actions: list[PermissionAction]


class AdminSession(CamelModel):
    access_token: str
    admin: AdminSummary
    permissions: list[AdminPermission]


class AdminAccount(CamelModel):
    id: str
    full_name: str
    email: str
    role: AdminRole
    suspended: bool
    mfa_enabled: bool
    last_sign_in_at: str | None = None


class AdminUserRow(CamelModel):
    id: str
    full_name: str
    email: str
    status: UserAccountStatus
    country: str
    created_at: str
    last_sign_in_at: str | None = None
    applications_count: int
    automatic_enabled: bool
    profile_completeness: int


class SecretMetadata(CamelModel):
    kind: str
    label: str
    created_at: str
    last_used_at: str | None = None


class AdminApplicationRow(CamelModel):
    id: str
    user_name: str
    opportunity_title: str
    organization: str
    submission_status: SubmissionStatus
    outcome_status: OutcomeStatus
    route: str
    mode: ApplicationMode
    updated_at: str


class AdminUserDetail(AdminUserRow):
    phone: str | None = None
    tracks: list[Track]
    recent_applications: list[AdminApplicationRow]
    sign_ins: list[SignInEvent]
    secrets: list[SecretMetadata]


class AdminOpportunityRow(CamelModel):
    id: str
    title: str
    organization: str
    country_code: str
    type: str
    status: OpportunityStatus
    discovered_at: str
    applications_count: int


class SourceDefaults(CamelModel):
    type: OpportunityType
    work_arrangement: WorkArrangement
    country_code: str = ""
    location: str = ""
    organization: str = ""


class SourceSetup(CamelModel):
    connector: str
    url: str
    defaults: SourceDefaults


class NewSource(SourceSetup):
    name: str


class AdminSourceRow(CamelModel):
    id: str
    name: str
    status: SourceStatus
    enabled: bool
    last_success_at: str | None = None
    failures_last24h: int = Field(alias="failuresLast24h")
    opportunities_found: int
    setup: SourceSetup | None = None


class EmergencyStop(CamelModel):
    active: bool
    scope: EmergencyStopScope | None = None
    target: str | None = None
    reason: str | None = None
    since: str | None = None


class PlatformSettings(CamelModel):
    active_theme: ThemeKey
    emergency_stop: EmergencyStop
    daily_application_cap: int
    approval_validity_days: int
    deletion_grace_days: int
    account_link_ttl_minutes: int | None = None


class AuditEntry(CamelModel):
    id: str
    at: str
    actor_name: str
    actor_type: ActorType
    action: str
    target: str


class CountByKey(CamelModel):
    key: str
    count: int


class DailyCount(CamelModel):
    date: str
    count: int


class ServiceStatus(CamelModel):
    service: str
    status: str


class NotificationCounts(CamelModel):
    sent: int
    delivered: int
    failed: int


T = TypeVar("T")


class Page(CamelModel, Generic[T]):
    items: list[T]
    total: int
    page: int
    page_size: int
