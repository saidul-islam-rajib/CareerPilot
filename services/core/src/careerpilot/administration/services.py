from collections import Counter
from collections.abc import Callable
from datetime import timedelta

from careerpilot.administration.context import ADMIN_AUDIENCE, AdminActor, AdminContext, PageRequest, paginate
from careerpilot.administration.discovery_sync import apply_check
from careerpilot.administration.models import (
    AdminAccount,
    AdminApplicationRow,
    AdminOpportunityRow,
    AdminSession,
    AdminSourceRow,
    AdminSummary,
    AdminUserDetail,
    AdminUserRow,
    AuditEntry,
    CountByKey,
    DailyCount,
    EmergencyStop,
    NotificationCounts,
    Page,
    PlatformSettings,
    ServiceStatus,
)
from careerpilot.administration.permissions import permissions_for_role
from careerpilot.discovery.service import DiscoveryService
from careerpilot.platform.clock import iso, parse_iso
from careerpilot.platform.coordination import GuardScope, SignInGuard
from careerpilot.platform.enums import (
    AdminArea,
    AdminRole,
    EmergencyStopScope,
    OpportunityStatus,
    PermissionAction,
    SourceStatus,
    SubmissionStatus,
    ThemeKey,
    UserAccountStatus,
)
from careerpilot.platform.errors import DomainError, ErrorCode, conflict, not_found, validation_error
from careerpilot.platform.model import CamelModel
from careerpilot.platform.validation import require_text

ISO_DATE_LENGTH = 10
RECENT_APPLICATIONS_LIMIT = 5
CANCELLABLE = frozenset({SubmissionStatus.APPROVED_QUEUED, SubmissionStatus.AWAITING_APPROVAL})


class UsersBlock(CamelModel):
    total: int
    new_this_week: int
    active: int
    paused: int
    suspended: int
    pending_deletion: int
    automatic_enabled: int
    incomplete_profiles: int


class ApplicationsBlock(CamelModel):
    total: int
    by_submission_status: list[CountByKey]
    by_outcome_status: list[CountByKey]
    by_mode: list[CountByKey]
    approvals_waiting: int
    failures: int
    outcome_unknown: int
    per_day: list[DailyCount]


class OpportunitiesBlock(CamelModel):
    discovered: int
    active: int
    expired: int
    flagged: int
    archived_circulars: int


class SourcesBlock(CamelModel):
    total: int
    healthy: int
    degraded: int
    failing: int
    disabled: int


class AdminDashboard(CamelModel):
    generated_at: str
    users: UsersBlock
    applications: ApplicationsBlock
    opportunities: OpportunitiesBlock
    sources: SourcesBlock
    notifications: NotificationCounts
    health: list[ServiceStatus]
    emergency_stop: EmergencyStop


def count_by(values: list[str]) -> list[CountByKey]:
    return [CountByKey(key=k, count=c) for k, c in Counter(values).most_common()]


class AdminAuthService:
    def __init__(self, context: AdminContext, guard: SignInGuard) -> None:
        self._ctx = context
        self._guard = guard

    def sign_in(self, email: str, password: str, client_ip: str) -> AdminSession:
        self._guard.ensure_allowed(GuardScope.ADMIN, email, client_ip)
        credential = self._ctx.admins.find_by_email(email)
        if credential is None or credential.account.suspended or not self._ctx.hasher.verify(credential.password_hash, password):
            self._guard.record_failure(GuardScope.ADMIN, email)
            raise DomainError(ErrorCode.INVALID_CREDENTIALS)
        self._guard.clear(GuardScope.ADMIN, email)
        credential.account.last_sign_in_at = iso(self._ctx.clock.now())
        self._ctx.admins.save(credential)
        summary = self._summary(credential.account)
        AdminActor(summary, self._ctx).record("admin.signed_in", credential.account.email)
        token = self._ctx.tokens.issue(summary.id, ADMIN_AUDIENCE, self._ctx.settings.security.admin_token_ttl_minutes)
        return AdminSession(access_token=token, admin=summary, permissions=permissions_for_role(summary.role))

    def authenticate(self, token: str) -> AdminActor:
        claims = self._ctx.tokens.verify(token, ADMIN_AUDIENCE)
        credential = self._ctx.admins.get(claims.subject)
        if credential is None or credential.account.suspended:
            raise DomainError(ErrorCode.UNAUTHORIZED)
        return AdminActor(self._summary(credential.account), self._ctx)

    @staticmethod
    def _summary(account: AdminAccount) -> AdminSummary:
        return AdminSummary(id=account.id, full_name=account.full_name, email=account.email, role=account.role)


class AdminDashboardService:
    def __init__(self, context: AdminContext) -> None:
        self._ctx = context

    def get(self, actor: AdminActor) -> AdminDashboard:
        actor.require(AdminArea.DASHBOARD, PermissionAction.READ)
        now = self._ctx.clock.now()
        users = self._ctx.directory.users()
        apps = self._ctx.directory.applications()
        opportunities = self._ctx.directory.opportunities()
        sources = self._ctx.directory.sources()
        operations = self._ctx.directory.operations()
        week_ago = now - timedelta(days=self._ctx.settings.account.recent_window_days)
        chart_days = self._ctx.settings.admin.chart_days
        days = [iso(now - timedelta(days=chart_days - 1 - i))[:ISO_DATE_LENGTH] for i in range(chart_days)]
        return AdminDashboard(
            generated_at=iso(now),
            users=UsersBlock(
                total=len(users),
                new_this_week=sum(1 for u in users if parse_iso(u.created_at) >= week_ago),
                active=sum(1 for u in users if u.status is UserAccountStatus.ACTIVE),
                paused=sum(1 for u in users if u.status is UserAccountStatus.PAUSED),
                suspended=sum(1 for u in users if u.status is UserAccountStatus.SUSPENDED),
                pending_deletion=sum(1 for u in users if u.status is UserAccountStatus.PENDING_DELETION),
                automatic_enabled=sum(1 for u in users if u.automatic_enabled),
                incomplete_profiles=sum(1 for u in users if u.profile_completeness < self._ctx.settings.admin.complete_profile_percent),
            ),
            applications=ApplicationsBlock(
                total=len(apps),
                by_submission_status=count_by([a.submission_status.value for a in apps]),
                by_outcome_status=count_by([a.outcome_status.value for a in apps]),
                by_mode=count_by([a.mode.value for a in apps]),
                approvals_waiting=sum(1 for a in apps if a.submission_status is SubmissionStatus.AWAITING_APPROVAL),
                failures=sum(1 for a in apps if a.submission_status is SubmissionStatus.FAILED),
                outcome_unknown=sum(1 for a in apps if a.submission_status is SubmissionStatus.OUTCOME_UNKNOWN),
                per_day=[DailyCount(date=d, count=sum(1 for a in apps if a.updated_at[:ISO_DATE_LENGTH] == d)) for d in days],
            ),
            opportunities=OpportunitiesBlock(
                discovered=len(opportunities),
                active=sum(1 for o in opportunities if o.status is OpportunityStatus.ACTIVE),
                expired=sum(1 for o in opportunities if o.status is OpportunityStatus.EXPIRED),
                flagged=sum(1 for o in opportunities if o.status is OpportunityStatus.FLAGGED),
                archived_circulars=operations.archived_circulars,
            ),
            sources=SourcesBlock(
                total=len(sources),
                healthy=sum(1 for s in sources if s.status is SourceStatus.HEALTHY),
                degraded=sum(1 for s in sources if s.status is SourceStatus.DEGRADED),
                failing=sum(1 for s in sources if s.status is SourceStatus.FAILING),
                disabled=sum(1 for s in sources if s.status is SourceStatus.DISABLED),
            ),
            notifications=operations.notifications,
            health=operations.services,
            emergency_stop=self._ctx.platform.get().emergency_stop,
        )


class AdminUserService:
    def __init__(self, context: AdminContext) -> None:
        self._ctx = context

    def list(self, actor: AdminActor, request: PageRequest) -> Page[AdminUserRow]:
        actor.require(AdminArea.USERS, PermissionAction.READ)
        return paginate(
            self._ctx.directory.users(),
            request,
            self._ctx.settings.admin.page_size,
            lambda u: f"{u.full_name} {u.email} {u.country}",
            lambda u: u.status.value,
        )

    def get(self, actor: AdminActor, user_id: str) -> AdminUserDetail:
        actor.require(AdminArea.USERS, PermissionAction.READ)
        row = self._row(user_id)
        actor.record("user.viewed_sensitive", row.full_name)
        return self._detail(row)

    def set_status(self, actor: AdminActor, user_id: str, status: UserAccountStatus, action: str) -> AdminUserDetail:
        actor.require(AdminArea.USERS, PermissionAction.UPDATE)
        row = self._row(user_id).model_copy(update={"status": status})
        self._ctx.directory.save_user(row)
        account = self._ctx.accounts.get(user_id)
        if account is not None:
            account.status = status
            self._ctx.accounts.save(account)
        actor.record(action, row.full_name)
        return self._detail(row)

    def _row(self, user_id: str) -> AdminUserRow:
        row = next((u for u in self._ctx.directory.users() if u.id == user_id), None)
        if row is None:
            raise not_found("user")
        return row

    def _detail(self, row: AdminUserRow) -> AdminUserDetail:
        operations = self._ctx.directory.operations()
        has_account = self._ctx.accounts.get(row.id) is not None
        workspace = self._ctx.workspaces.get(row.id) if has_account else None
        recent = [a for a in self._ctx.directory.applications() if a.user_name == row.full_name][:RECENT_APPLICATIONS_LIMIT]
        return AdminUserDetail(
            **row.model_dump(),
            phone=operations.user_phones.get(row.id),
            tracks=workspace.preferences.tracks if workspace else [],
            recent_applications=recent,
            sign_ins=workspace.sign_in_events if workspace else [],
            secrets=operations.user_secrets.get(row.id, []),
        )


class AdminCatalogService:
    def __init__(self, context: AdminContext, discovery: DiscoveryService) -> None:
        self._ctx = context
        self._discovery = discovery

    def opportunities(self, actor: AdminActor, request: PageRequest) -> Page[AdminOpportunityRow]:
        actor.require(AdminArea.OPPORTUNITIES, PermissionAction.READ)
        rows = self._ctx.directory.opportunities()
        return paginate(
            rows,
            request,
            self._ctx.settings.admin.page_size,
            lambda o: f"{o.title} {o.organization} {o.country_code}",
            lambda o: o.status.value,
        )

    def set_opportunity_status(self, actor: AdminActor, opportunity_id: str, status: OpportunityStatus, action: str) -> AdminOpportunityRow:
        actor.require(AdminArea.OPPORTUNITIES, PermissionAction.UPDATE)
        row = next((o for o in self._ctx.directory.opportunities() if o.id == opportunity_id), None)
        if row is None:
            raise not_found("opportunity")
        updated = row.model_copy(update={"status": status})
        self._ctx.directory.save_opportunity(updated)
        actor.record(action, updated.title)
        return updated

    def sources(self, actor: AdminActor, request: PageRequest) -> Page[AdminSourceRow]:
        actor.require(AdminArea.SOURCES, PermissionAction.READ)
        return paginate(
            self._ctx.directory.sources(), request, self._ctx.settings.admin.page_size, lambda s: s.name, lambda s: s.status.value
        )

    def set_source_enabled(self, actor: AdminActor, source_id: str, enabled: bool) -> AdminSourceRow:
        actor.require(AdminArea.SOURCES, PermissionAction.UPDATE)
        row = self._source(source_id)
        updated = row.model_copy(update={"enabled": enabled, "status": SourceStatus.HEALTHY if enabled else SourceStatus.DISABLED})
        self._ctx.directory.save_source(updated)
        actor.record("source.enabled" if enabled else "source.disabled", updated.name)
        return updated

    def run_source_check(self, actor: AdminActor, source_id: str) -> AdminSourceRow:
        actor.require(AdminArea.SOURCES, PermissionAction.UPDATE)
        row = self._source(source_id)
        if not row.enabled:
            raise conflict("source_disabled")
        check = self._discovery.run(source_id)
        updated = apply_check(self._ctx.directory, row, check, self._ctx.settings.discovery.failing_after_failures)
        actor.record("source.checked", f"{updated.name} · {check.outcome.value}")
        return updated

    def applications(self, actor: AdminActor, request: PageRequest) -> Page[AdminApplicationRow]:
        actor.require(AdminArea.APPLICATIONS, PermissionAction.READ)
        rows = sorted(self._ctx.directory.applications(), key=lambda a: a.updated_at, reverse=True)
        return paginate(
            rows,
            request,
            self._ctx.settings.admin.page_size,
            lambda a: f"{a.user_name} {a.opportunity_title} {a.organization}",
            lambda a: a.submission_status.value,
        )

    def cancel_application(self, actor: AdminActor, application_id: str) -> AdminApplicationRow:
        actor.require(AdminArea.APPLICATIONS, PermissionAction.UPDATE)
        row = next((a for a in self._ctx.directory.applications() if a.id == application_id), None)
        if row is None:
            raise not_found("application")
        if row.submission_status not in CANCELLABLE:
            raise conflict("application_not_cancellable")
        updated = row.model_copy(update={"submission_status": SubmissionStatus.CANCELLED, "updated_at": iso(self._ctx.clock.now())})
        self._ctx.directory.save_application(updated)
        actor.record("application.cancelled", f"{updated.opportunity_title} · {updated.user_name}")
        return updated

    def _source(self, source_id: str) -> AdminSourceRow:
        row = next((s for s in self._ctx.directory.sources() if s.id == source_id), None)
        if row is None:
            raise not_found("source")
        return row


class PlatformSettingsService:
    def __init__(self, context: AdminContext, on_change: Callable[[], None]) -> None:
        self._ctx = context
        self._on_change = on_change

    def get(self, actor: AdminActor) -> PlatformSettings:
        actor.require(AdminArea.SETTINGS, PermissionAction.READ)
        return self._ctx.platform.get()

    def active_theme(self) -> ThemeKey:
        return self._ctx.platform.get().active_theme

    def update(self, actor: AdminActor, changes: dict[str, object]) -> PlatformSettings:
        actor.require(AdminArea.SETTINGS, PermissionAction.UPDATE)
        current = self._ctx.platform.get()
        allowed = {"active_theme", "daily_application_cap", "approval_validity_days", "deletion_grace_days"}
        applied = {k: v for k, v in changes.items() if k in allowed and v is not None}
        if any(isinstance(v, int) and v <= 0 for v in applied.values()):
            raise validation_error("settings")
        updated = PlatformSettings.model_validate({**current.model_dump(), **applied})
        self._save(updated)
        actor.record("settings.updated", ", ".join(sorted(applied)))
        return updated

    def start_emergency_stop(self, actor: AdminActor, scope: EmergencyStopScope, reason: str, target: str | None) -> PlatformSettings:
        actor.require(AdminArea.SETTINGS, PermissionAction.UPDATE)
        text = require_text(reason, self._ctx.settings.validation.answer)
        current = self._ctx.platform.get()
        stop = EmergencyStop(active=True, scope=scope, target=target, reason=text, since=iso(self._ctx.clock.now()))
        updated = current.model_copy(update={"emergency_stop": stop})
        self._save(updated)
        actor.record("emergency_stop.started", text)
        return updated

    def _save(self, updated: PlatformSettings) -> None:
        self._ctx.platform.save(updated)
        self._on_change()

    def end_emergency_stop(self, actor: AdminActor) -> PlatformSettings:
        actor.require(AdminArea.SETTINGS, PermissionAction.UPDATE)
        updated = self._ctx.platform.get().model_copy(update={"emergency_stop": EmergencyStop(active=False)})
        self._save(updated)
        actor.record("emergency_stop.ended", "")
        return updated


class AdminAuditService:
    def __init__(self, context: AdminContext) -> None:
        self._ctx = context

    def list(self, actor: AdminActor, request: PageRequest) -> Page[AuditEntry]:
        actor.require(AdminArea.AUDIT, PermissionAction.READ)
        entries = self._ctx.audit.list_all()
        return paginate(
            entries,
            request,
            self._ctx.settings.admin.page_size,
            lambda e: f"{e.actor_name} {e.action} {e.target}",
            lambda e: e.actor_type.value,
        )


class AdminAccountService:
    def __init__(self, context: AdminContext) -> None:
        self._ctx = context

    def list(self, actor: AdminActor) -> list[AdminAccount]:
        actor.require(AdminArea.ADMINS, PermissionAction.READ)
        return self._ctx.admins.list_all()

    def update(self, actor: AdminActor, admin_id: str, role: AdminRole | None, suspended: bool | None) -> AdminAccount:
        actor.require(AdminArea.ADMINS, PermissionAction.UPDATE)
        credential = self._ctx.admins.get(admin_id)
        if credential is None:
            raise not_found("admin")
        if admin_id == actor.summary.id:
            raise conflict("cannot_change_self")
        if role is not None:
            credential.account.role = role
            actor.record("admin.role_changed", f"{credential.account.email} → {role.value}")
        if suspended is not None:
            credential.account.suspended = suspended
            actor.record("admin.suspended" if suspended else "admin.reactivated", credential.account.email)
        self._ctx.admins.save(credential)
        return credential.account
