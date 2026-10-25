import os
from enum import StrEnum
from pathlib import Path
from typing import Any, Literal, cast

import yaml
from pydantic import BaseModel, ConfigDict, Field, HttpUrl

from careerpilot.platform.enums import PauseDuration, ThemeKey

CONFIG_ROOT_ENV = "CAREERPILOT_CONFIG_ROOT"
APP_ENV = "APP_ENV"
DEFAULT_APP_ENV = "local"
YAML_SUFFIX = ".yaml"


class Strict(BaseModel):
    model_config = ConfigDict(extra="ignore", frozen=True)


class PauseOptionConfig(Strict):
    duration: PauseDuration
    amount: int | None = None


class AccountConfig(Strict):
    locale: str
    default_time_zone: str
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


class UiConfig(Strict):
    active_theme: ThemeKey
    admin_theme: ThemeKey


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
    database_url_env: str


class ObservabilityConfig(Strict):
    enabled: bool
    otlp_endpoint_env: str
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
    cache_url_env: str
    coord_url_env: str
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
    fixture: str
    defaults: ListingDefaults


class WarningSignConfig(Strict):
    upfront_fee: list[str]
    guaranteed_offer: list[str]
    sensitive_data_request: list[str]
    free_mail_domains: list[str]


class DiscoveryConfig(Strict):
    fetch_mode: FetchMode
    fixture_root: str
    user_agent: str
    timeout_seconds: float = Field(gt=0)
    max_listings_per_check: int = Field(gt=0)
    failing_after_failures: int = Field(gt=0)
    sources: dict[str, SourceDefinition]
    warning_signs: WarningSignConfig


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


class SponsorshipPhrases(Strict):
    negative: list[str]
    positive: list[str]


class MatchingConfig(Strict):
    mode: MatchingMode
    model: str
    effort: Effort
    max_tokens: int = Field(gt=0)
    api_key_env: str
    prompt_file: str
    rules_version: str
    min_score: int = Field(ge=0, le=100)
    include_flagged: bool
    default_route: str
    weights: MatchWeights
    track_rules: dict[str, TrackRule]
    sponsorship: SponsorshipPhrases


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
    matching: MatchingConfig


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
