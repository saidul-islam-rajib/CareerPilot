import os
from collections.abc import Callable, Mapping
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from importlib.metadata import version
from pathlib import Path

import anthropic

from careerpilot.administration.account_links import AdminLinkContext, AdminLinkService, invite_owner
from careerpilot.administration.context import AdminContext
from careerpilot.administration.discovery_sync import SourceCheckRunner, discover_when_empty
from careerpilot.administration.limits import effective_source_limit
from careerpilot.administration.models import AdminSourceRow, EmergencyStop, PlatformSettings
from careerpilot.administration.services import (
    AdminAccountService,
    AdminAuditService,
    AdminAuthService,
    AdminCatalogService,
    AdminDashboardService,
    AdminUserService,
    PlatformSettingsService,
    effective_link_ttl_minutes,
)
from careerpilot.administration.sources import SourcePolicy, directory_definitions, is_link_source, listing_visibility
from careerpilot.administration.user_sources import UserSourceContext, UserSourceService
from careerpilot.candidate.context import CandidateContext
from careerpilot.candidate.models import Preferences, Profile, SubmissionWindow, Track
from careerpilot.candidate.ports import CandidateWorkspace
from careerpilot.candidate.services.account_links import AccountLinkContext, AccountLinkPolicy, AccountLinkService
from careerpilot.candidate.services.answers import AnswerService
from careerpilot.candidate.services.applications import ApplicationService
from careerpilot.candidate.services.approvals import ApprovalService
from careerpilot.candidate.services.auth import AuthService
from careerpilot.candidate.services.dashboard import DashboardService
from careerpilot.candidate.services.digest import DigestContext, DigestService
from careerpilot.candidate.services.job_links import JobLinkContext, JobLinkService
from careerpilot.candidate.services.opportunities import OpportunityService
from careerpilot.candidate.services.preferences import PreferencesService
from careerpilot.candidate.services.profile import ProfileService
from careerpilot.candidate.services.public_config import LivePlatformValues, PublicConfigService, enum_value_documents
from careerpilot.candidate.services.submission import SubmissionContext, SubmissionService
from careerpilot.candidate.services.verification import ContactVerificationService, VerificationContext
from careerpilot.discovery.connectors.json_jobs import JsonJobsConnector
from careerpilot.discovery.connectors.registry import ConnectorRegistry, first_party_connectors
from careerpilot.discovery.fetchers import PageFetcher, fetcher_for, page_fetcher_for
from careerpilot.discovery.job_links import JobLinkReader
from careerpilot.discovery.models import Listing
from careerpilot.discovery.ports import Fetcher
from careerpilot.discovery.resolver import SourceResolver
from careerpilot.discovery.safety import public_https_url
from careerpilot.discovery.service import DiscoveryContext, DiscoveryService
from careerpilot.matching.claude import ClaudeMatcher
from careerpilot.matching.ports import Matcher
from careerpilot.matching.rules import RuleBasedMatcher
from careerpilot.matching.service import RecommendationContext, RecommendationService
from careerpilot.platform.clock import Clock, IdGenerator, SystemClock, UuidIdGenerator, iso
from careerpilot.platform.config import (
    CoordinationMode,
    MatchingMode,
    PersistenceMode,
    Settings,
    load_settings,
    repository_root,
    with_web_address,
)
from careerpilot.platform.coordination import KeySpace, MetadataCache, SignInGuard, release_fingerprint
from careerpilot.platform.email_delivery import (
    BackgroundCourier,
    Courier,
    DirectCourier,
    EmailSender,
    RecipientRoutingSender,
    SmtpEmailSender,
    SmtpLogin,
    SmtpSettings,
    connect_smtp,
    connect_smtp_tls,
)
from careerpilot.platform.enums import ApplicationMode, DeliveryMode, SmtpSecurity, SubmissionWindowKind
from careerpilot.platform.files import FileLinkSigner, FileStorage, LocalFileStorage, SampleAwareStorage
from careerpilot.platform.keyvalue import InMemoryKeyValueStore, KeyValueStore, RedisKeyValueStore
from careerpilot.platform.messages import translate
from careerpilot.platform.one_time_codes import OneTimeCodes, random_token
from careerpilot.platform.persistence import Database, create_database
from careerpilot.platform.security import Argon2PasswordHasher, PasswordHasher, TokenService, token_secret_from_environment
from careerpilot.repositories import Repositories, RepositoryFactory, WorkspaceFactory, in_memory_repositories, sql_repositories

EMPTY_PROFILE_COMPLETENESS = 0
PACKAGE = "careerpilot-core"
MAIL_THREAD_PREFIX = "careerpilot-mail"


@dataclass(frozen=True)
class Container:
    settings: Settings
    database: Database | None
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
    discovery: DiscoveryService
    recommendations: RecommendationService
    files: FileStorage
    file_links: FileLinkSigner
    submissions: SubmissionService
    digests: DigestService
    verification: ContactVerificationService
    answers: AnswerService
    user_sources: UserSourceService
    job_links: JobLinkService
    source_checks: SourceCheckRunner
    invite_owner: Callable[[], bool]


def default_tracks(settings: Settings) -> list[Track]:
    return [
        Track(id=t.id, kind=t.kind, result_count=t.result_count, mode=ApplicationMode.APPROVE_EACH, position=t.position)
        for t in settings.tracks.defaults
    ]


def default_platform_settings(settings: Settings) -> PlatformSettings:
    return PlatformSettings(
        active_theme=settings.ui.active_theme,
        emergency_stop=EmergencyStop(active=False),
        daily_application_cap=settings.platform.daily_application_cap,
        approval_validity_days=settings.account.approval_validity_days,
        deletion_grace_days=settings.account.deletion_grace_days,
    )


def empty_workspace_factory(settings: Settings, clock: Clock) -> WorkspaceFactory:
    def create(user_id: str) -> CandidateWorkspace:
        tracks = default_tracks(settings)
        return CandidateWorkspace(
            profile=Profile(
                id=f"prf_{user_id}",
                full_name="",
                headline="",
                completeness=EMPTY_PROFILE_COMPLETENESS,
                contacts=[],
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
    repositories: RepositoryFactory | None = None
    database_url: str | None = None
    database: Database | None = None
    cache_store: KeyValueStore | None = None
    coord_store: KeyValueStore | None = None
    fetcher: Fetcher | None = None
    connectors: ConnectorRegistry | None = None
    matcher: Matcher | None = None
    file_storage: FileStorage | None = None
    email_sender: EmailSender | None = None
    address_check: Callable[[str], str | None] | None = None
    page_fetcher: PageFetcher | None = None


def _redis_store(settings: Settings, url_env: str) -> KeyValueStore:
    url = os.environ.get(url_env)
    if not url:
        raise RuntimeError(url_env)
    return RedisKeyValueStore.from_url(url, settings.coordination.socket_timeout_seconds)


def _stores(settings: Settings, clock: Clock, options: ContainerOverrides) -> tuple[KeyValueStore, KeyValueStore]:
    coordination = settings.coordination
    if coordination.mode is CoordinationMode.REDIS:
        return (
            options.cache_store or _redis_store(settings, coordination.cache_url_env),
            options.coord_store or _redis_store(settings, coordination.coord_url_env),
        )
    return options.cache_store or InMemoryKeyValueStore(clock), options.coord_store or InMemoryKeyValueStore(clock)


def account_sender_for(settings: Settings, sandbox: EmailSender, environ: Mapping[str, str] = os.environ) -> EmailSender:
    mail = settings.mail
    user = environ.get(mail.smtp_user_env, "").strip()
    password = environ.get(mail.smtp_password_env, "").strip()
    if not user or not password:
        return sandbox
    connect = connect_smtp_tls if mail.smtp_security is SmtpSecurity.TLS else connect_smtp
    live = SmtpEmailSender(
        SmtpSettings(
            host=mail.smtp_host,
            port=mail.smtp_port,
            timeout_seconds=mail.smtp_timeout_seconds,
            mode=DeliveryMode.LIVE,
            sandbox_hosts=frozenset(),
            security=mail.smtp_security,
            login=SmtpLogin(user=user, password=password),
        ),
        connect,
    )
    return RecipientRoutingSender(live, sandbox, frozenset(mail.sandbox_only_domains))


def background_courier(settings: Settings, sender: EmailSender) -> Courier:
    mail = settings.mail
    runner = ThreadPoolExecutor(max_workers=mail.delivery_workers, thread_name_prefix=MAIL_THREAD_PREFIX)
    return BackgroundCourier(sender, mail.delivery_attempts, mail.retry_delay_seconds, runner)


def email_sender_for(settings: Settings) -> EmailSender:
    config = settings.submission
    smtp = SmtpSettings(
        host=os.environ.get(config.smtp_host_env, config.smtp_default_host),
        port=config.smtp_port,
        timeout_seconds=config.smtp_timeout_seconds,
        mode=config.delivery_mode,
        sandbox_hosts=frozenset(config.sandbox_hosts),
    )
    return SmtpEmailSender(smtp)


def storage_root(settings: Settings) -> Path:
    root = Path(settings.profile.storage.local_root)
    return root if root.is_absolute() else repository_root() / root


def matcher_for(settings: Settings, clock: Clock) -> Matcher:
    rules = RuleBasedMatcher(settings.matching, clock)
    api_key = os.environ.get(settings.matching.api_key_env)
    if settings.matching.mode is MatchingMode.CLAUDE and api_key:
        return ClaudeMatcher(settings.matching, clock, anthropic.Anthropic(api_key=api_key), rules)
    return rules


def _repositories(
    options: ContainerOverrides, database: Database | None, hasher: PasswordHasher, empty: WorkspaceFactory, defaults: PlatformSettings
) -> Repositories:
    if options.repositories is not None:
        return options.repositories(hasher, empty, defaults)
    if database is not None:
        return sql_repositories(database, empty, defaults)
    return in_memory_repositories(empty, defaults)


def _database_url(settings: Settings, options: ContainerOverrides) -> str:
    url = options.database_url or os.environ.get(settings.persistence.database_url_env)
    if not url:
        raise RuntimeError(settings.persistence.database_url_env)
    return url


def visible_listings(discovery: DiscoveryService, visibility: Callable[[str], Callable[[Listing], bool]]) -> Callable[[str], list[Listing]]:
    def for_user(user_id: str) -> list[Listing]:
        visible = visibility(user_id)
        return [listing for listing in discovery.listings() if visible(listing)]

    return for_user


def source_display_name(rows: list[AdminSourceRow], source_id: str) -> str:
    if is_link_source(source_id):
        return translate("opportunity.addedByLink")
    return next((row.name for row in rows if row.id == source_id), source_id)


def build_container(overrides: ContainerOverrides | None = None) -> Container:
    options = overrides or ContainerOverrides()
    cfg = options.settings or with_web_address(load_settings())
    clk = options.clock or SystemClock()
    gen = options.ids or UuidIdGenerator()
    pwd = options.hasher or Argon2PasswordHasher()
    secret = options.token_secret or token_secret_from_environment()
    tokens = TokenService(cfg.security, clk, secret)
    storage = SampleAwareStorage(options.file_storage or LocalFileStorage(storage_root(cfg)))
    file_links = FileLinkSigner(secret, clk, cfg.profile.storage.signed_url_ttl_seconds)
    empty = empty_workspace_factory(cfg, clk)
    database = (
        options.database or create_database(_database_url(cfg, options), clk) if cfg.persistence.mode is PersistenceMode.DATABASE else None
    )
    repos = _repositories(options, database, pwd, empty, default_platform_settings(cfg))

    candidate = CandidateContext(cfg, clk, gen, repos.accounts, repos.opportunities, repos.workspaces, pwd, tokens)
    admin = AdminContext(
        settings=cfg,
        clock=clk,
        ids=gen,
        admins=repos.admins,
        platform=repos.platform,
        audit=repos.audit,
        directory=repos.directory,
        accounts=repos.accounts,
        workspaces=repos.workspaces,
        hasher=pwd,
        tokens=tokens,
    )
    cache_store, coord_store = _stores(cfg, clk, options)
    keys = KeySpace(cfg.coordination)
    guard = SignInGuard(coord_store, keys, cfg.coordination)
    fetch_page = options.page_fetcher or page_fetcher_for(cfg.discovery)
    json_jobs = [JsonJobsConnector(cfg.discovery.json_fields, cfg.discovery.date_formats)]
    registry = options.connectors or first_party_connectors(lambda url: fetch_page(url)[1], cfg.discovery.max_detail_pages, json_jobs)
    discovery = DiscoveryService(
        DiscoveryContext(
            config=cfg.discovery,
            clock=clk,
            ids=gen,
            registry=registry,
            fetcher=options.fetcher or fetcher_for(cfg.discovery),
            catalog=repos.listings,
            extra_sources=lambda: directory_definitions(repos.directory),
        )
    )
    source_policy = SourcePolicy(
        connectors=frozenset(registry.keys()),
        check_address=options.address_check or public_https_url,
        suggestions=cfg.discovery.suggested_sources,
        resolve=SourceResolver(fetch_page, options.connectors or first_party_connectors(extra=json_jobs), cfg.discovery).resolve,
    )
    opportunity_service = OpportunityService(candidate)
    approvals = ApprovalService(candidate, opportunity_service)
    recommendations = RecommendationService(
        RecommendationContext(
            config=cfg.matching,
            matcher=options.matcher or matcher_for(cfg, clk),
            listings=visible_listings(discovery, listing_visibility(repos.directory.sources)),
            source_name=lambda source_id: source_display_name(repos.directory.sources(), source_id),
            accounts=repos.accounts,
            opportunities=repos.opportunities,
            workspaces=repos.workspaces,
            apply_by_rule=approvals.approve_by_rule,
        )
    )
    discover_when_empty(discovery, repos.directory, cfg.discovery.failing_after_failures)
    recommendations.refresh_all()
    source_checks = SourceCheckRunner(
        discovery, repos.directory, cfg.discovery.failing_after_failures, recommendations.refresh_all, source_policy.healed
    )
    sender = options.email_sender or email_sender_for(cfg)
    digests = DigestService(DigestContext(candidate=candidate, sender=sender))
    submissions = SubmissionService(SubmissionContext(candidate=candidate, platform=repos.platform.get, sender=sender, storage=storage))
    courier = DirectCourier(options.email_sender) if options.email_sender else background_courier(cfg, account_sender_for(cfg, sender))
    codes = OneTimeCodes(coord_store, keys, cfg.verification, secret)
    verification = ContactVerificationService(VerificationContext(candidate=candidate, codes=codes, courier=courier))

    def link_ttl_minutes() -> int:
        return effective_link_ttl_minutes(repos.platform.get(), cfg.account_links)

    link_codes = OneTimeCodes(coord_store, keys, AccountLinkPolicy(cfg.account_links, link_ttl_minutes), secret, generate=random_token)
    account_links = AccountLinkService(
        AccountLinkContext(candidate=candidate, codes=link_codes, courier=courier, ttl_minutes=link_ttl_minutes)
    )
    admin_links = AdminLinkService(AdminLinkContext(admin=admin, codes=link_codes, courier=courier, ttl_minutes=link_ttl_minutes))
    release = release_fingerprint(cfg.model_dump_json(), version(PACKAGE))
    metadata = MetadataCache(cache_store, keys, cfg.coordination, release=release)
    live = LivePlatformValues(
        active_theme=lambda: repos.platform.get().active_theme,
        link_ttl_minutes=link_ttl_minutes,
        source_limit=lambda: effective_source_limit(repos.platform.get(), cfg.job_sources),
    )
    public_config = PublicConfigService(cfg, enum_value_documents(cfg.enum_values), live, metadata)
    public_config.invalidate()
    admin_settings = PlatformSettingsService(admin, public_config.invalidate)
    return Container(
        settings=cfg,
        database=database,
        auth=AuthService(candidate, guard, account_links),
        public_config=public_config,
        opportunities=opportunity_service,
        approvals=approvals,
        applications=ApplicationService(candidate),
        profile=ProfileService(candidate, storage, file_links, recommendations.rematch),
        preferences=PreferencesService(candidate, recommendations.rematch),
        dashboard=DashboardService(candidate, opportunity_service),
        admin_auth=AdminAuthService(admin, guard, admin_links),
        admin_dashboard=AdminDashboardService(admin),
        admin_users=AdminUserService(admin),
        admin_catalog=AdminCatalogService(admin, source_checks, source_policy, recommendations.refresh_all),
        admin_settings=admin_settings,
        admin_audit=AdminAuditService(admin),
        admin_accounts=AdminAccountService(admin),
        discovery=discovery,
        recommendations=recommendations,
        source_checks=source_checks,
        files=storage,
        file_links=file_links,
        submissions=submissions,
        digests=digests,
        verification=verification,
        answers=AnswerService(candidate),
        job_links=JobLinkService(
            JobLinkContext(
                check_address=options.address_check or public_https_url,
                reader=JobLinkReader(fetch_page),
                discovery=discovery,
                recommendations=recommendations,
                opportunities=opportunity_service,
            )
        ),
        user_sources=UserSourceService(
            UserSourceContext(admin=admin, checks=source_checks, policy=source_policy, refresh=recommendations.rematch)
        ),
        invite_owner=lambda: invite_owner(admin, admin_links),
    )
