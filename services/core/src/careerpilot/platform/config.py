import os
from collections.abc import Mapping
from enum import StrEnum
from pathlib import Path
from typing import Annotated, Any, Literal, cast
from urllib.parse import urlsplit, urlunsplit

import yaml
from pydantic import BaseModel, ConfigDict, Field, HttpUrl, model_validator

from careerpilot.platform.enums import (
    AnswerTopic,
    ApplicationRoute,
    CompletenessKind,
    DeliveryMode,
    PauseDuration,
    ProfileFieldType,
    SmtpSecurity,
    ThemeKey,
)

CONFIG_ROOT_ENV = "CAREERPILOT_CONFIG_ROOT"
APP_ENV = "APP_ENV"
DEFAULT_APP_ENV = "local"
YAML_SUFFIX = ".yaml"
SECONDS_PER_MINUTE = 60
ENV_NAME_PATTERN = r"^[A-Z][A-Z0-9_]*$"
WEB_SCHEMES = frozenset({"http", "https"})
USERINFO_MARK = "@"
PATH_SEPARATOR = "/"
INVALID_WEB_BASE_URL = "web_base_url_invalid"


EnvName = Annotated[str, Field(pattern=ENV_NAME_PATTERN)]


class Strict(BaseModel):
    model_config = ConfigDict(extra="ignore", frozen=True)


class PauseOptionConfig(Strict):
    duration: PauseDuration
    amount: int | None = None


class AccountConfig(Strict):
    locale: str
    default_time_zone: str
    default_country_code: str = Field(pattern=r"^[A-Z]{2}$")
    max_favorite_companies: int = Field(gt=0)
    deletion_grace_days: int = Field(gt=0)
    approval_validity_days: int = Field(gt=0)
    recent_window_days: int = Field(gt=0)
    pause_options: list[PauseOptionConfig]


class LegalConfig(Strict):
    terms_url: HttpUrl
    privacy_url: HttpUrl
    terms_version: str
    privacy_version: str


class BrandingConfig(Strict):
    product_name: str
    developer_name: str
    developer_url: HttpUrl


class DisplayConfig(Strict):
    strong_match_score: int = Field(ge=0, le=100)
    fair_match_score: int = Field(ge=0, le=100)
    urgent_deadline_days: int = Field(ge=0)


class TimeRangePreset(Strict):
    key: str
    start: str
    end: str


class UiConfig(Strict):
    active_theme: ThemeKey
    admin_theme: ThemeKey
    save_delay_ms: int = Field(gt=0)
    search_suggestion_limit: int = Field(gt=0)
    learn_skill_url: str
    submission_window_presets: list[TimeRangePreset]


class PasswordPolicy(Strict):
    min_length: int
    max_length: int
    require_mixed_case: bool
    require_digit: bool
    require_symbol: bool


class LengthPolicy(Strict):
    min_length: int = 0
    max_length: int


class TrackPolicy(Strict):
    min_result_count: int
    max_result_count: int


class ValidationConfig(Strict):
    password: PasswordPolicy
    name: LengthPolicy
    email: LengthPolicy
    answer: LengthPolicy
    note: LengthPolicy
    track: TrackPolicy


class OpenSourceComponent(Strict):
    name: str
    licence: str
    url: HttpUrl


class AdminConfig(Strict):
    page_size: int = Field(gt=0)
    chart_days: int = Field(gt=0)
    complete_profile_percent: int = Field(ge=0, le=100)
    session_timeout_minutes: int = Field(gt=0)


class SecurityConfig(Strict):
    token_ttl_minutes: int = Field(gt=0)
    admin_token_ttl_minutes: int = Field(gt=0)
    token_issuer: str
    token_algorithm: str


class HttpConfig(Strict):
    user_api_port: int = Field(gt=0)
    admin_api_port: int = Field(gt=0)
    host: str
    cors_origins: list[str]
    trusted_proxy_hops: int = Field(ge=0)


class PersistenceMode(StrEnum):
    MEMORY = "memory"
    DATABASE = "database"


class PersistenceConfig(Strict):
    mode: PersistenceMode
    database_url_env: EnvName


class ObservabilityConfig(Strict):
    enabled: bool
    otlp_endpoint_env: EnvName
    trace_sample_ratio: float = Field(ge=0, le=1)
    metric_export_interval_ms: int = Field(gt=0)
    log_level: str
    user_api_service: str
    admin_api_service: str
    redacted: str
    scrub_keys: list[str]


class CoordinationMode(StrEnum):
    MEMORY = "memory"
    REDIS = "redis"


class RateLimitPolicy(Strict):
    limit: int = Field(gt=0)
    window_seconds: int = Field(gt=0)


class CoordinationConfig(Strict):
    mode: CoordinationMode
    cache_url_env: EnvName
    coord_url_env: EnvName
    key_prefix: str
    environment: str
    socket_timeout_seconds: float = Field(gt=0)
    metadata_ttl_seconds: int = Field(gt=0)
    ttl_jitter_ratio: float = Field(ge=0, lt=1)
    sign_in_failures: RateLimitPolicy
    auth_requests: RateLimitPolicy


class FetchMode(StrEnum):
    FIXTURE = "fixture"
    LIVE = "live"


class ListingDefaults(Strict):
    type: str
    work_arrangement: str
    country_code: str
    location: str = ""
    organization: str = ""


class SourceDefinition(Strict):
    connector: str
    url: str
    fixture: str = ""
    defaults: ListingDefaults


class SuggestedSource(Strict):
    name: str
    connector: str
    url: str
    defaults: ListingDefaults


class WarningSignConfig(Strict):
    upfront_fee: list[str]
    guaranteed_offer: list[str]
    sensitive_data_request: list[str]
    free_mail_domains: list[str]


class JobBoardPattern(Strict):
    connector: str
    pattern: str
    api: str
    reserved: list[str] = Field(default_factory=list[str])


class JsonJobFields(Strict):
    title: list[str]
    link: list[str]
    deadline: list[str]
    description: list[str]
    location: list[str]


class JobSourcesConfig(Strict):
    max_per_user: int = Field(gt=0)
    min_limit: int = Field(gt=0)
    max_limit: int = Field(gt=0)

    def allows(self, limit: int) -> bool:
        return self.min_limit <= limit <= self.max_limit


class JobPlatformMarker(Strict):
    connector: str
    marker: str
    path: str


class ClassificationConfig(Strict):
    scan_chars: int = Field(gt=0)
    arrangements: dict[str, list[str]]
    places: dict[str, list[str]]


class CompanySearchConfig(Strict):
    name_similarity: float = Field(gt=0, le=1)
    known_similarity: float = Field(gt=0, le=1)
    parallel_requests: int = Field(gt=0)
    max_seconds: float = Field(gt=0)
    probe_timeout_seconds: float = Field(gt=0)
    max_handles: int = Field(gt=0)
    max_sites: int = Field(gt=0)
    min_exact_handle: int = Field(gt=0)
    domains: list[str]
    legal_words: list[str]
    generic_words: list[str]
    handle_suffixes: list[str]


class DiscoveryConfig(Strict):
    fetch_mode: FetchMode
    fixture_root: str = ""
    user_agent: str
    timeout_seconds: float = Field(gt=0)
    fetch_attempts: int = Field(gt=0)
    max_redirects: int = Field(ge=0)
    max_listings_per_check: int = Field(gt=0)
    failing_after_failures: int = Field(gt=0)
    max_resolve_pages: int = Field(gt=0)
    max_career_links: int = Field(gt=0)
    min_job_links: int = Field(gt=0)
    enough_job_links: int = Field(gt=0)
    max_detail_pages: int = Field(ge=0)
    max_script_scans: int = Field(ge=0)
    json_fields: JsonJobFields
    date_formats: list[str]
    job_page_paths: list[str]
    job_boards: list[JobBoardPattern]
    job_platforms: list[JobPlatformMarker]
    ignored_hosts: list[str]
    company_search: CompanySearchConfig
    classification: ClassificationConfig
    sources: dict[str, SourceDefinition]
    suggested_sources: list[SuggestedSource] = Field(default_factory=list[SuggestedSource])
    warning_signs: WarningSignConfig


class EnumValueConfig(Strict):
    enum_key: str
    value: str
    label_key: str
    tone: str
    sort_order: int
    is_terminal: bool
    is_active: bool


class DefaultTrack(Strict):
    id: str
    kind: str
    result_count: int = Field(gt=0)
    position: int = Field(gt=0)


class TracksConfig(Strict):
    lead_kinds: list[str] = Field(default_factory=list[str])
    defaults: list[DefaultTrack]


class PlatformDefaultsConfig(Strict):
    daily_application_cap: int = Field(gt=0)


class MatchingMode(StrEnum):
    RULES = "rules"
    CLAUDE = "claude"


Effort = Literal["low", "medium", "high", "xhigh", "max"]


class MatchWeights(Strict):
    base: int = Field(ge=0)
    title: int = Field(ge=0)
    skill: int = Field(ge=0)
    max_skills: int = Field(ge=0)
    arrangement: int = Field(ge=0)


class TrackRule(Strict):
    work_arrangements: list[str] = Field(default_factory=list[str])
    country_codes: list[str] = Field(default_factory=list[str])
    exclude_country_codes: list[str] = Field(default_factory=list[str])
    types: list[str] = Field(default_factory=list[str])
    require_sponsorship: bool = False
    home_country: bool = False
    exclude_home_country: bool = False


class SponsorshipPhrases(Strict):
    negative: list[str]
    positive: list[str]


class ApplicationEmailConfig(Strict):
    window_chars: int = Field(gt=0)
    phrases: list[str]
    excluded_words: list[str]


class SkillGapConfig(Strict):
    limit: int = Field(ge=0)
    title_weight: int = Field(ge=1)
    vocabulary: dict[str, list[str]]


class MatchingConfig(Strict):
    mode: MatchingMode
    model: str
    effort: Effort
    max_tokens: int = Field(gt=0)
    api_key_env: EnvName
    prompt_file: str
    rules_version: str
    min_score: int = Field(ge=0, le=100)
    include_flagged: bool
    default_route: str
    application_email: ApplicationEmailConfig
    reapply_cooldown_days: int = Field(ge=0)
    max_jobs_per_company: int = Field(ge=1)
    skill_gap: SkillGapConfig
    weights: MatchWeights
    track_rules: dict[str, TrackRule]
    sponsorship: SponsorshipPhrases


class WorkersConfig(Strict):
    temporal_address_env: EnvName
    namespace: str
    discovery_task_queue: str
    discovery_workflow_id: str
    discovery_schedule_id: str
    discovery_interval_minutes: int = Field(gt=0)
    activity_timeout_seconds: int = Field(gt=0)
    activity_max_attempts: int = Field(gt=0)
    submission_task_queue: str
    submission_workflow_id: str
    submission_schedule_id: str
    submission_interval_minutes: int = Field(gt=0)
    digest_workflow_id: str
    digest_schedule_id: str
    digest_interval_minutes: int = Field(gt=0)


class ProfileFieldConfig(Strict):
    key: str
    type: ProfileFieldType
    required: bool = False
    max_length: int | None = Field(default=None, gt=0)
    min: float | None = None
    max: float | None = None
    options: str | None = None


class ProfileSectionConfig(Strict):
    key: str
    icon: str
    title_field: str
    subtitle_fields: list[str] = Field(default_factory=list[str])
    start_field: str | None = None
    end_field: str | None = None
    ongoing_field: str | None = None
    body_field: str | None = None
    link_field: str | None = None
    fields: list[ProfileFieldConfig]

    def field(self, key: str) -> ProfileFieldConfig | None:
        return next((f for f in self.fields if f.key == key), None)


class ProfileLimits(Strict):
    max_contacts: int = Field(gt=0)
    max_skills: int = Field(gt=0)
    max_skill_length: int = Field(gt=0)
    max_entries_per_section: int = Field(gt=0)
    max_documents: int = Field(gt=0)
    headline_max_length: int = Field(gt=0)
    location_max_length: int = Field(gt=0)
    summary_max_length: int = Field(gt=0)
    contact_label_max_length: int = Field(gt=0)
    document_name_max_length: int = Field(gt=0)
    phone_pattern: str
    min_year: int
    future_years: int = Field(ge=0)
    min_skills_for_completeness: int = Field(ge=0)


class UploadConfig(Strict):
    max_document_bytes: int = Field(gt=0)
    max_photo_bytes: int = Field(gt=0)
    document_types: list[str]
    photo_types: list[str]


class StorageConfig(Strict):
    local_root: str
    signed_url_ttl_seconds: int = Field(gt=0)


class CompletenessRule(Strict):
    kind: CompletenessKind
    weight: int = Field(ge=0)
    section: str | None = None

    @property
    def key(self) -> str:
        return self.section or self.kind.value


class ProfileConfig(Strict):
    page_order: list[str]
    limits: ProfileLimits
    uploads: UploadConfig
    storage: StorageConfig
    completeness: list[CompletenessRule]
    sections: list[ProfileSectionConfig]

    def section(self, key: str) -> ProfileSectionConfig | None:
        return next((s for s in self.sections if s.key == key), None)


class SubmissionConfig(Strict):
    delivery_mode: DeliveryMode
    smtp_host_env: EnvName
    smtp_default_host: str
    smtp_port: int = Field(gt=0)
    smtp_timeout_seconds: float = Field(gt=0)
    sandbox_hosts: list[str]
    sender_address: str
    bounce_window_hours: int = Field(gt=0)
    max_attempts: int = Field(gt=0)
    automatable_routes: list[ApplicationRoute]
    cover_letter_skills: int = Field(gt=0)
    stuck_after_minutes: int = Field(gt=0)


TIME_OF_DAY_PATTERN = r"^([01]\d|2[0-3]):[0-5]\d$"


class DigestTimePreset(Strict):
    key: str
    time: str = Field(pattern=TIME_OF_DAY_PATTERN)


class NotificationsConfig(Strict):
    default_digest_time: str = Field(pattern=TIME_OF_DAY_PATTERN)
    digest_time_presets: list[DigestTimePreset]
    web_base_url: str
    web_base_url_env: EnvName
    max_items_per_section: int = Field(gt=0)


class VerificationConfig(Strict):
    code_length: int = Field(ge=4, le=10)
    code_ttl_seconds: int = Field(gt=0)
    max_attempts: int = Field(gt=0)
    resend_cooldown_seconds: int = Field(ge=0)
    sends_per_hour: int = Field(gt=0)
    sms_enabled: bool


class MailConfig(Strict):
    sender_address: str = Field(pattern=r"^[^@\s]+@[^@\s]+$")
    smtp_host: str
    smtp_port: int = Field(gt=0)
    smtp_security: SmtpSecurity
    smtp_timeout_seconds: float = Field(gt=0)
    smtp_user_env: EnvName
    smtp_password_env: EnvName
    sandbox_only_domains: list[str]
    delivery_attempts: int = Field(gt=0)
    retry_delay_seconds: float = Field(ge=0)
    delivery_workers: int = Field(gt=0)


class AccountLinksConfig(Strict):
    token_bytes: int = Field(ge=16, le=64)
    ttl_minutes: int = Field(gt=0)
    min_ttl_minutes: int = Field(gt=0)
    max_ttl_minutes: int = Field(gt=0)
    max_attempts: int = Field(gt=0)
    sends_per_hour: int = Field(gt=0)
    set_password_path: str = Field(pattern=r"^/")
    sign_in_path: str = Field(pattern=r"^/")
    admin_web_base_url: str
    owner_email_env: EnvName

    @model_validator(mode="after")
    def _default_within_bounds(self) -> "AccountLinksConfig":
        if not self.min_ttl_minutes <= self.ttl_minutes <= self.max_ttl_minutes:
            raise ValueError("account_links.ttl_minutes")
        return self

    def allows(self, minutes: int) -> bool:
        return self.min_ttl_minutes <= minutes <= self.max_ttl_minutes


class TrackingConfig(Strict):
    task_title_max_length: int = Field(gt=0)
    task_notes_max_length: int = Field(gt=0)
    task_location_max_length: int = Field(gt=0)
    outcome_note_max_length: int = Field(gt=0)
    upcoming_days: int = Field(gt=0)
    upcoming_limit: int = Field(gt=0)
    follow_up_after_days: int = Field(gt=0)
    default_task_time: str = Field(pattern=TIME_OF_DAY_PATTERN)


class TopicKeywordsConfig(Strict):
    topic: AnswerTopic
    keywords: list[str]


class AnswersConfig(Strict):
    question_max_length: int = Field(gt=0)
    max_saved_answers: int = Field(gt=0)
    topic_keywords: list[TopicKeywordsConfig]

    def keywords(self) -> dict[AnswerTopic, list[str]]:
        return {entry.topic: entry.keywords for entry in self.topic_keywords}


class AttachmentRule(Strict):
    types: list[str]
    max_bytes: int = Field(gt=0)
    max_seconds: int = Field(default=0, ge=0)


class MessagingConfig(Strict):
    poll_seconds: int = Field(gt=0)
    open_conversation_poll_seconds: int = Field(gt=0)
    page_size: int = Field(gt=0)
    max_text_length: int = Field(gt=0)
    directory_min_query: int = Field(gt=0)
    directory_limit: int = Field(gt=0)
    notifications_page_size: int = Field(gt=0)
    preview_length: int = Field(gt=0)
    attachments: dict[str, AttachmentRule]


class PresenceConfig(Strict):
    touch_interval_seconds: int = Field(gt=0)
    idle_minutes: int = Field(gt=0)
    online_minutes: int = Field(gt=0)
    time_zone_header: str
    country_header: str
    max_sessions_per_user: int = Field(gt=0)


class Settings(Strict):
    account: AccountConfig
    legal: LegalConfig
    branding: BrandingConfig
    display: DisplayConfig
    ui: UiConfig
    validation: ValidationConfig
    open_source_components: list[OpenSourceComponent]
    admin: AdminConfig
    security: SecurityConfig
    http: HttpConfig
    persistence: PersistenceConfig
    observability: ObservabilityConfig
    coordination: CoordinationConfig
    discovery: DiscoveryConfig
    job_sources: JobSourcesConfig
    matching: MatchingConfig
    workers: WorkersConfig
    profile: ProfileConfig
    submission: SubmissionConfig
    notifications: NotificationsConfig
    verification: VerificationConfig
    account_links: AccountLinksConfig
    mail: MailConfig
    tracking: TrackingConfig
    answers: AnswersConfig
    enum_values: list[EnumValueConfig]
    tracks: TracksConfig
    platform: PlatformDefaultsConfig
    presence: PresenceConfig
    messaging: MessagingConfig


def deep_merge(base: dict[str, Any], override: dict[str, Any]) -> dict[str, Any]:
    result = dict(base)
    for key, value in override.items():
        existing = result.get(key)
        if isinstance(existing, dict) and isinstance(value, dict):
            result[key] = deep_merge(cast("dict[str, Any]", existing), cast("dict[str, Any]", value))
        else:
            result[key] = value
    return result


def _read_yaml(path: Path) -> dict[str, Any]:
    loaded: object = yaml.safe_load(path.read_text(encoding="utf-8"))
    return cast("dict[str, Any]", loaded) if isinstance(loaded, dict) else {}


def repository_root() -> Path:
    return Path(__file__).resolve().parents[5]


def default_config_root() -> Path:
    configured = os.environ.get(CONFIG_ROOT_ENV)
    if configured:
        return Path(configured)
    return repository_root() / "config"


def load_raw_config(app_env: str, root: Path) -> dict[str, Any]:
    merged: dict[str, Any] = {}
    for file in sorted((root / "defaults").glob(f"*{YAML_SUFFIX}")):
        merged = deep_merge(merged, _read_yaml(file))
    env_file = root / "env" / f"{app_env}{YAML_SUFFIX}"
    return deep_merge(merged, _read_yaml(env_file)) if env_file.exists() else merged


def load_settings(app_env: str | None = None, root: Path | None = None) -> Settings:
    environment = app_env or os.environ.get(APP_ENV, DEFAULT_APP_ENV)
    return Settings.model_validate(load_raw_config(environment, root or default_config_root()))


def web_base_url(value: str) -> str:
    parts = urlsplit(value.strip())
    if parts.scheme not in WEB_SCHEMES or not parts.hostname or USERINFO_MARK in parts.netloc or parts.query or parts.fragment:
        raise ValueError(INVALID_WEB_BASE_URL)
    return urlunsplit((parts.scheme, parts.netloc, parts.path.rstrip(PATH_SEPARATOR), "", ""))


def url_origin(url: str) -> str:
    parts = urlsplit(url)
    return urlunsplit((parts.scheme, parts.netloc, "", "", ""))


def with_web_address(settings: Settings, environ: Mapping[str, str] = os.environ) -> Settings:
    configured = environ.get(settings.notifications.web_base_url_env, "").strip()
    if not configured:
        return settings
    base_url = web_base_url(configured)
    origin = url_origin(base_url)
    http = settings.http
    origins = http.cors_origins if origin in http.cors_origins else [*http.cors_origins, origin]
    return settings.model_copy(
        update={
            "notifications": settings.notifications.model_copy(update={"web_base_url": base_url}),
            "http": http.model_copy(update={"cors_origins": origins}),
        }
    )
