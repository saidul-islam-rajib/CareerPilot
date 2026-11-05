from pydantic import Field

from careerpilot.platform.model import CamelModel
from careerpilot.portal.enums import (
    AccountOrigin,
    AccountStatus,
    AttemptState,
    FieldKind,
    FieldSource,
    FieldStatus,
    HostPolicy,
    Intent,
    ReadinessState,
    RunMode,
    StopReason,
    Verdict,
    WallKind,
)


class Permissions(CamelModel):
    allow_account_creation: bool = False
    account_email: str | None = None
    accept_terms: bool = False
    accept_privacy: bool = False
    allow_email_verification: bool = False


class RulePermissions(CamelModel):
    allow_account_creation: bool | None = None
    account_email: str | None = None
    accept_terms: bool | None = None
    accept_privacy: bool | None = None


class PortalSettings(CamelModel):
    enabled: bool = False
    enabled_at: str | None = None
    summary_version: int = 0
    permissions: Permissions = Field(default_factory=Permissions)


class AutopilotInput(CamelModel):
    acknowledged: bool
    allow_account_creation: bool = False
    account_email: str | None = None
    accept_terms: bool = False
    accept_privacy: bool = False
    allow_email_verification: bool = False


class AutopilotSummary(CamelModel):
    summary_version: int
    user_only_steps: list[str]
    routes: list[str]
    rule_names: list[str]
    document_names: list[str]
    live: bool
    mail_connected: bool


class AutopilotState(CamelModel):
    settings: PortalSettings
    summary: AutopilotSummary


class FieldPlan(CamelModel):
    handle: str
    label: str
    kind: FieldKind
    required: bool
    source: FieldSource | None = None
    status: FieldStatus
    value: str = ""
    intent: Intent | None = None
    stop: StopReason | None = None


class PortalAccount(CamelModel):
    id: str
    host: str
    employer: str
    email: str
    sealed_password: str
    status: AccountStatus = AccountStatus.ACTIVE
    origin: AccountOrigin = AccountOrigin.CREATED
    login_attempts: int = 0
    site_url: str = ""
    created_at: str
    last_used_at: str | None = None


class AccountView(CamelModel):
    id: str
    host: str
    employer: str
    email: str
    status: AccountStatus
    origin: AccountOrigin
    site_url: str
    created_at: str
    last_used_at: str | None = None


class AccountSecret(CamelModel):
    id: str
    host: str
    email: str
    password: str


class AccountInput(CamelModel):
    host: str
    employer: str = ""
    email: str
    password: str
    site_url: str = ""


class PreparedAnswer(CamelModel):
    label: str
    value: str
    source: FieldSource | None = None


class PendingQuestion(CamelModel):
    label: str
    reason: StopReason
    options: list[str] = Field(default_factory=list[str])


class AttemptView(CamelModel):
    application_id: str
    state: AttemptState
    stop: StopReason | None = None
    detail: str = ""
    official_url: str
    host: str
    prepared: list[PreparedAnswer] = Field(default_factory=list[PreparedAnswer])
    pending: list[PendingQuestion] = Field(default_factory=list[PendingQuestion])
    submit_clicked: bool = False
    runs: int = 0
    final_url: str = ""
    confirmation_text: str = ""
    evidence_key: str = ""
    updated_at: str = ""


class ResumeAnswer(CamelModel):
    label: str
    answer: str


class ResumeInput(CamelModel):
    answers: list[ResumeAnswer] = Field(default_factory=list[ResumeAnswer])


class HostRecord(CamelModel):
    host: str
    policy: HostPolicy
    note: str = ""
    configured: bool = False
    decided_at: str | None = None


class HostInput(CamelModel):
    policy: HostPolicy
    note: str = ""


class ReadinessRequest(CamelModel):
    url: str


class ReadinessReport(CamelModel):
    id: str
    url: str
    host: str
    state: ReadinessState
    requested_at: str
    requested_by: str
    finished_at: str | None = None
    host_policy: HostPolicy | None = None
    wall: WallKind = WallKind.NONE
    captcha_seen: bool = False
    page_title: str = ""
    final_url: str = ""
    fields: list[FieldPlan] = Field(default_factory=list[FieldPlan])
    mapped: int = 0
    unknown: int = 0
    verdict: Verdict | None = None
    reasons: list[StopReason] = Field(default_factory=list[StopReason])
    mode: RunMode = RunMode.READINESS
    error: str = ""
