from collections.abc import Callable
from typing import Any, cast

from pydantic.alias_generators import to_camel

from careerpilot.platform.config import SECONDS_PER_MINUTE, EnumValueConfig, Settings
from careerpilot.platform.coordination import MetadataCache
from careerpilot.platform.enums import ThemeKey

PUBLIC_CONFIG_CACHE = "public-config"
PUBLIC_PROFILE_KEYS = {"page_order", "sections", "limits", "uploads", "completeness"}


def camel_keys(value: Any) -> Any:
    if isinstance(value, dict):
        return {to_camel(str(k)): camel_keys(v) for k, v in cast("dict[str, Any]", value).items()}
    if isinstance(value, list):
        return [camel_keys(v) for v in cast("list[Any]", value)]
    return value


def enum_value_documents(values: list[EnumValueConfig]) -> list[dict[str, Any]]:
    return [camel_keys(v.model_dump()) for v in values]


class PublicConfigService:
    def __init__(
        self,
        settings: Settings,
        enum_values: list[dict[str, Any]],
        active_theme: Callable[[], ThemeKey],
        cache: MetadataCache,
        link_ttl_minutes: Callable[[], int],
    ) -> None:
        self._settings = settings
        self._enum_values = enum_values
        self._active_theme = active_theme
        self._cache = cache
        self._link_ttl_minutes = link_ttl_minutes

    def get(self) -> dict[str, Any]:
        return self._cache.get_or_load(PUBLIC_CONFIG_CACHE, self._build)

    def invalidate(self) -> None:
        self._cache.invalidate(PUBLIC_CONFIG_CACHE)

    def _build(self) -> dict[str, Any]:
        s = self._settings
        policy = s.validation
        return {
            "theme": self._active_theme().value,
            "display": {
                "strongMatchScore": s.display.strong_match_score,
                "fairMatchScore": s.display.fair_match_score,
                "urgentDeadlineDays": s.display.urgent_deadline_days,
            },
            "locale": s.account.locale,
            "defaultTimeZone": s.account.default_time_zone,
            "enumValues": self._enum_values,
            "validationPolicy": {
                "password": {
                    "minLength": policy.password.min_length,
                    "maxLength": policy.password.max_length,
                    "requireMixedCase": policy.password.require_mixed_case,
                    "requireDigit": policy.password.require_digit,
                    "requireSymbol": policy.password.require_symbol,
                },
                "name": {"minLength": policy.name.min_length, "maxLength": policy.name.max_length},
                "email": {"maxLength": policy.email.max_length},
                "answer": {"maxLength": policy.answer.max_length},
                "note": {"maxLength": policy.note.max_length},
                "track": {"minResultCount": policy.track.min_result_count, "maxResultCount": policy.track.max_result_count},
            },
            "pauseOptions": [
                {"duration": o.duration.value, **({"amount": o.amount} if o.amount is not None else {})} for o in s.account.pause_options
            ],
            "accountDeletionGraceDays": s.account.deletion_grace_days,
            "legal": {
                "termsUrl": str(s.legal.terms_url),
                "privacyUrl": str(s.legal.privacy_url),
                "termsVersion": s.legal.terms_version,
                "privacyVersion": s.legal.privacy_version,
            },
            "branding": {
                "productName": s.branding.product_name,
                "developerName": s.branding.developer_name,
                "developerUrl": str(s.branding.developer_url),
            },
            "openSourceComponents": [{"name": c.name, "licence": c.licence, "url": str(c.url)} for c in s.open_source_components],
            "tracking": camel_keys(s.tracking.model_dump(mode="json")),
            "jobSources": {"maxPerUser": s.job_sources.max_per_user},
            "answers": {
                "questionMaxLength": s.answers.question_max_length,
                "maxSavedAnswers": s.answers.max_saved_answers,
                "topicKeywords": [{"topic": e.topic.value, "keywords": e.keywords} for e in s.answers.topic_keywords],
            },
            "verification": {
                "codeLength": s.verification.code_length,
                "codeTtlSeconds": s.verification.code_ttl_seconds,
                "resendCooldownSeconds": s.verification.resend_cooldown_seconds,
                "smsEnabled": s.verification.sms_enabled,
            },
            "accountLinks": {
                "ttlMinutes": self._link_ttl_minutes(),
                "resendCooldownSeconds": self._link_ttl_minutes() * SECONDS_PER_MINUTE,
                "minTtlMinutes": s.account_links.min_ttl_minutes,
                "maxTtlMinutes": s.account_links.max_ttl_minutes,
            },
            "notifications": {
                "defaultDigestTime": s.notifications.default_digest_time,
                "digestTimePresets": [{"key": p.key, "time": p.time} for p in s.notifications.digest_time_presets],
            },
            "profile": camel_keys(s.profile.model_dump(mode="json", include=PUBLIC_PROFILE_KEYS, exclude_none=True)),
        }
