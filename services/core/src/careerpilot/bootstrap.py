from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from careerpilot.administration.adapters.in_memory import (
    InMemoryAdminAccountRepository,
    InMemoryAuditLog,
    InMemoryDirectory,
    InMemoryPlatformSettingsRepository,
    admin_credentials_from_seed,
    audit_from_seed,
    platform_settings_from_seed,
)
from careerpilot.administration.context import AdminContext
from careerpilot.administration.services import (
    AdminAccountService,
    AdminAuditService,
    AdminAuthService,
    AdminCatalogService,
    AdminDashboardService,
    AdminUserService,
    PlatformSettingsService,
)
from careerpilot.candidate.adapters.in_memory import (
    InMemoryAccountRepository,
    InMemoryOpportunityRepository,
    InMemoryWorkspaceRepository,
    accounts_from_seed,
    opportunities_from_seed,
    workspace_from_seed,
)
from careerpilot.candidate.context import CandidateContext
from careerpilot.candidate.models import Preferences, Profile, SubmissionWindow, Track
from careerpilot.candidate.ports import CandidateWorkspace
from careerpilot.candidate.services.applications import ApplicationService
from careerpilot.candidate.services.approvals import ApprovalService
from careerpilot.candidate.services.auth import AuthService
from careerpilot.candidate.services.dashboard import DashboardService
from careerpilot.candidate.services.opportunities import OpportunityService
from careerpilot.candidate.services.preferences import PreferencesService
from careerpilot.candidate.services.profile import ProfileService
from careerpilot.candidate.services.public_config import PublicConfigService
from careerpilot.platform.clock import Clock, IdGenerator, SystemClock, UuidIdGenerator, iso
from careerpilot.platform.config import Settings, load_settings
from careerpilot.platform.enums import ApplicationMode, SubmissionWindowKind
from careerpilot.platform.security import Argon2PasswordHasher, PasswordHasher, TokenService, token_secret_from_environment
from careerpilot.platform.seed import load_demo_seed

EMPTY_PROFILE_COMPLETENESS = 0


@dataclass(frozen=True)
class Container:
    settings: Settings
    auth: AuthService
    public_config: PublicConfigService
    opportunities: OpportunityService
    approvals: ApprovalService
    applications: ApplicationService
    profile: ProfileService
    preferences: PreferencesService
    dashboard: DashboardService
    admin_auth: AdminAuthService
    admin_dashboard: AdminDashboardService
    admin_users: AdminUserService
    admin_catalog: AdminCatalogService
    admin_settings: PlatformSettingsService
    admin_audit: AdminAuditService
    admin_accounts: AdminAccountService


def empty_workspace_factory(settings: Settings, clock: Clock, demo: dict[str, Any]) -> Callable[[str], CandidateWorkspace]:
    default_tracks = [Track.model_validate(t) for t in demo["user"]["settings"]["tracks"]]

    def create(user_id: str) -> CandidateWorkspace:
        tracks = [t.model_copy(update={"mode": ApplicationMode.APPROVE_EACH}) for t in default_tracks]
        return CandidateWorkspace(
            profile=Profile(
                id=f"prf_{user_id}",
                full_name="",
                headline="",
                completeness=EMPTY_PROFILE_COMPLETENESS,
                contacts=[],
                education=[],
                experience=[],
                skills=[],
                documents=[],
            ),
            preferences=Preferences(
                tracks=tracks,
                submission_window=SubmissionWindow(kind=SubmissionWindowKind.AS_SOON_AS_READY),
                time_zone=settings.account.default_time_zone,
            ),
            track_opportunities={},
            approvals=[],
            applications=[],
            sign_in_events=[],
            last_checked_at=iso(clock.now()),
        )

    return create


@dataclass(frozen=True)
class ContainerOverrides:
    settings: Settings | None = None
    clock: Clock | None = None
    ids: IdGenerator | None = None
    hasher: PasswordHasher | None = None
    token_secret: str | None = None
    seed_path: Path | None = None


def build_container(overrides: ContainerOverrides | None = None) -> Container:
    options = overrides or ContainerOverrides()
    cfg = options.settings or load_settings()
    clk = options.clock or SystemClock()
    gen = options.ids or UuidIdGenerator()
    pwd = options.hasher or Argon2PasswordHasher()
    tokens = TokenService(cfg.security, clk, options.token_secret or token_secret_from_environment())
    demo = load_demo_seed(clk.now(), options.seed_path)

    accounts = InMemoryAccountRepository()
    for account in accounts_from_seed(demo["user"], pwd):
        accounts.add(account)
    workspaces = InMemoryWorkspaceRepository(empty_workspace_factory(cfg, clk, demo))
    for account in demo["user"]["accounts"]:
        workspaces.save(str(account["user"]["id"]), workspace_from_seed(demo["user"]))
    opportunities = InMemoryOpportunityRepository(opportunities_from_seed(demo["user"]))
    platform = InMemoryPlatformSettingsRepository(platform_settings_from_seed(demo["admin"]))

    candidate = CandidateContext(cfg, clk, gen, accounts, opportunities, workspaces, pwd, tokens)
    admin = AdminContext(
        settings=cfg,
        clock=clk,
        ids=gen,
        admins=InMemoryAdminAccountRepository(admin_credentials_from_seed(demo["admin"], pwd)),
        platform=platform,
        audit=InMemoryAuditLog(audit_from_seed(demo["admin"])),
        directory=InMemoryDirectory(demo["admin"]),
        accounts=accounts,
        workspaces=workspaces,
        hasher=pwd,
        tokens=tokens,
    )
    opportunity_service = OpportunityService(candidate)
    admin_settings = PlatformSettingsService(admin)
    return Container(
        settings=cfg,
        auth=AuthService(candidate),
        public_config=PublicConfigService(cfg, demo["enumValues"], admin_settings.active_theme),
        opportunities=opportunity_service,
        approvals=ApprovalService(candidate, opportunity_service),
        applications=ApplicationService(candidate),
        profile=ProfileService(candidate),
        preferences=PreferencesService(candidate),
        dashboard=DashboardService(candidate, opportunity_service),
        admin_auth=AdminAuthService(admin),
        admin_dashboard=AdminDashboardService(admin),
        admin_users=AdminUserService(admin),
        admin_catalog=AdminCatalogService(admin),
        admin_settings=admin_settings,
        admin_audit=AdminAuditService(admin),
        admin_accounts=AdminAccountService(admin),
    )
