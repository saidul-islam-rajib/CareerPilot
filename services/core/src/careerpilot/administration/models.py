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
    SourceReview,
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
    type: OpportunityType = OpportunityType.JOB
    work_arrangement: WorkArrangement = WorkArrangement.NOT_STATED
    country_code: str = ""
    location: str = ""
    organization: str = ""


class SourceSetup(CamelModel):
    connector: str
    url: str
    site_url: str = ""
    defaults: SourceDefaults


class NewSource(CamelModel):
    url: str
    name: str = ""
    connector: str = ""
    defaults: SourceDefaults = Field(default_factory=SourceDefaults)


class AdminSourceRow(CamelModel):
    id: str
    name: str
    status: SourceStatus
    enabled: bool
    last_success_at: str | None = None
    failures_last24h: int = Field(alias="failuresLast24h")
    opportunities_found: int
    setup: SourceSetup | None = None
    last_checked_at: str | None = None
    last_error: str = ""
    review: SourceReview = SourceReview.APPROVED
    owner_ids: list[str] = Field(default_factory=list[str])
    requested_at: str | None = None
    request_note: str = ""
    reviewed_at: str | None = None
    review_note: str = ""


class UserSource(CamelModel):
    id: str
    name: str
    site_url: str
    status: SourceStatus
    review: SourceReview
    jobs_found: int
    added_at: str | None = None
    last_checked_at: str | None = None
    last_error: str = ""
    review_note: str = ""
    arrangements: dict[str, int] = Field(default_factory=dict[str, int])


class SourceJob(CamelModel):
    id: str
    title: str
    location: str
    country_code: str
    work_arrangement: str
    deadline: str | None = None
    url: str
    listed: bool


class SourceJobs(CamelModel):
    source: UserSource
    jobs: list[SourceJob]


class SavedSourceJob(CamelModel):
    opportunity_id: str


class NewUserSource(CamelModel):
    url: str
    name: str = ""
    note: str = ""


class SourceDecision(CamelModel):
    review: SourceReview
    note: str


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
    max_sources_per_user: int | None = None


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
