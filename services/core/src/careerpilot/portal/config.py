from pydantic import BaseModel, ConfigDict, Field

from careerpilot.platform.enums import ApplicationRoute
from careerpilot.portal.enums import Fact, HostPolicy, Intent, PageKind


class PortalBase(BaseModel):
    model_config = ConfigDict(extra="ignore", frozen=True)


class HostEntry(PortalBase):
    host: str
    policy: HostPolicy
    note: str = ""


class PasswordPolicy(PortalBase):
    length: int = Field(ge=12)
    lowercase: str
    uppercase: str
    digits: str
    symbols: str


class VerificationConfig(PortalBase):
    recent_minutes: int = Field(gt=0)
    max_polls: int = Field(gt=0)
    poll_interval_seconds: float = Field(ge=0)
    max_messages: int = Field(gt=0)
    code_pattern: str
    link_pattern: str
    link_words: list[str]
    query_template: str
    sender_template: str
    any_separator: str


class AdapterSelectors(PortalBase):
    apply: list[str] = Field(default_factory=list[str])
    sign_in_link: list[str] = Field(default_factory=list[str])
    register_link: list[str] = Field(default_factory=list[str])
    submit: list[str] = Field(default_factory=list[str])
    next: list[str] = Field(default_factory=list[str])
    confirmation: list[str] = Field(default_factory=list[str])
    captcha: list[str] = Field(default_factory=list[str])


class AdapterConfig(PortalBase):
    key: str
    hosts: list[str]
    selectors: AdapterSelectors = Field(default_factory=AdapterSelectors)
    mail_sender_domains: list[str] = Field(default_factory=list[str])


class FactSynonyms(PortalBase):
    fact: Fact
    autocomplete: list[str] = Field(default_factory=list[str])
    names: list[str] = Field(default_factory=list[str])
    labels: list[str] = Field(default_factory=list[str])


class IntentTerms(PortalBase):
    intent: Intent
    terms: list[str]


class PageTerms(PortalBase):
    kind: PageKind
    terms: list[str]


class ThrottleConfig(PortalBase):
    min_interval_seconds: float = Field(ge=0)
    max_concurrent_per_host: int = Field(gt=0)
    max_concurrent_total: int = Field(gt=0)


class BrowserConfig(PortalBase):
    navigation_timeout_seconds: float = Field(gt=0)
    action_timeout_seconds: float = Field(gt=0)
    settle_seconds: float = Field(ge=0)
    viewport_width: int = Field(gt=0)
    viewport_height: int = Field(gt=0)
    headless: bool


class ButtonLabels(PortalBase):
    apply: list[str]
    sign_in: list[str]
    create_account: list[str]
    next: list[str]
    submit: list[str]
    verify: list[str]


class FormLimits(PortalBase):
    max_pages: int = Field(gt=0)
    max_fields_per_page: int = Field(gt=0)
    max_text_chars: int = Field(gt=0)
    max_label_chars: int = Field(gt=0)
    max_evidence_chars: int = Field(gt=0)
    max_login_attempts: int = Field(gt=0)
    max_list_items: int = Field(gt=0)


class PortalsConfig(PortalBase):
    routes: list[ApplicationRoute]
    limits: FormLimits
    browser: BrowserConfig
    throttle: ThrottleConfig
    password: PasswordPolicy
    verification: VerificationConfig
    vault_context: str
    task_queue: str
    workflow_id: str
    schedule_id: str
    interval_minutes: int = Field(gt=0)
    activity_timeout_seconds: int = Field(gt=0)
    readiness_batch: int = Field(gt=0)
    evidence_prefix: str
    buttons: ButtonLabels
    hosts: list[HostEntry]
    adapters: list[AdapterConfig]
    facts: list[FactSynonyms]
    intents: list[IntentTerms]
    pages: list[PageTerms]
    captcha_selectors: list[str]
    positive_answers: list[str]
    negative_answers: list[str]
    declined_answers: list[str]
    placeholder_markers: list[str]
    user_only_steps: list[str]
    summary_version: int = Field(gt=0)

    def adapter_for(self, host: str) -> AdapterConfig | None:
        return next((a for a in self.adapters if any(host_matches(host, pattern) for pattern in a.hosts)), None)

    def configured_policy(self, host: str) -> HostEntry | None:
        matches = [e for e in self.hosts if host_matches(host, e.host)]
        return max(matches, key=lambda e: len(e.host), default=None)

    def terms_for(self, kind: PageKind) -> list[str]:
        return [term for entry in self.pages if entry.kind is kind for term in entry.terms]

    def intent_terms(self, intent: Intent) -> list[str]:
        return [term for entry in self.intents if entry.intent is intent for term in entry.terms]


def host_matches(host: str, pattern: str) -> bool:
    lowered = host.lower()
    wanted = pattern.lower()
    return lowered == wanted or lowered.endswith(f".{wanted}")
