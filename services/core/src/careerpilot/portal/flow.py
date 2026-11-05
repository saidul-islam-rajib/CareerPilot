import time
from collections.abc import Callable
from dataclasses import dataclass, field

from careerpilot.candidate.models import SavedAnswer
from careerpilot.portal.accounts import PortalAccounts
from careerpilot.portal.config import AdapterConfig, AdapterSelectors, PortalsConfig
from careerpilot.portal.detection import Observation, PageClassifier, mentions
from careerpilot.portal.driver import DriverError, FormField, PageDriver
from careerpilot.portal.enums import (
    Fact,
    FieldKind,
    FieldStatus,
    FlowOutcome,
    PageKind,
    RunMode,
    StopReason,
    WallKind,
)
from careerpilot.portal.filling import FillMaterials, apply_plans
from careerpilot.portal.mapping import FieldMapper, MappingContext
from careerpilot.portal.models import FieldPlan, PendingQuestion, Permissions, PreparedAnswer
from careerpilot.portal.verification import VerificationHit

STOP_OF_PAGE = {
    PageKind.CAPTCHA: StopReason.CAPTCHA,
    PageKind.MFA: StopReason.MFA,
    PageKind.IDENTITY: StopReason.IDENTITY,
    PageKind.ASSESSMENT: StopReason.ASSESSMENT,
    PageKind.VIDEO: StopReason.VIDEO,
    PageKind.PAYMENT: StopReason.PAYMENT,
    PageKind.CLOSED: StopReason.CLOSED,
    PageKind.ALREADY_APPLIED: StopReason.ALREADY_APPLIED,
}
WALL_OF_PAGE = {PageKind.SIGN_IN: WallKind.SIGN_IN, PageKind.REGISTER: WallKind.REGISTER}
TEXT_FIELD_KINDS = frozenset({FieldKind.TEXT, FieldKind.NUMBER})


@dataclass(frozen=True)
class CvFile:
    name: str
    content: bytes


@dataclass(frozen=True)
class FlowInput:
    user_id: str
    job_url: str
    host: str
    employer: str
    mode: RunMode
    facts: dict[Fact, str]
    saved_answers: list[SavedAnswer]
    permissions: Permissions
    cover_letter: str = ""
    cv: CvFile | None = None


@dataclass
class FlowResult:
    outcome: FlowOutcome = FlowOutcome.STOPPED
    stop: StopReason | None = None
    wall: WallKind = WallKind.NONE
    captcha_seen: bool = False
    plans: list[FieldPlan] = field(default_factory=list[FieldPlan])
    pages: list[PageKind] = field(default_factory=list[PageKind])
    submit_clicked: bool = False
    final_url: str = ""
    title: str = ""
    confirmation_text: str = ""
    screenshot: bytes | None = None
    account_id: str | None = None
    pending: list[PendingQuestion] = field(default_factory=list[PendingQuestion])
    prepared: list[PreparedAnswer] = field(default_factory=list[PreparedAnswer])
    detail: str = ""


@dataclass(frozen=True)
class FlowDeps:
    driver: PageDriver
    config: PortalsConfig
    adapter: AdapterConfig | None
    accounts: PortalAccounts
    fetch_verification: Callable[[], VerificationHit | None]
    before_submit: Callable[[], None] = lambda: None
    sleep: Callable[[float], None] = time.sleep


class Finished(Exception):
    def __init__(self, stop: StopReason | None = None, outcome: FlowOutcome = FlowOutcome.STOPPED) -> None:
        super().__init__(stop.value if stop else outcome.value)
        self.stop = stop
        self.outcome = outcome


class PortalFlow:
    def __init__(self, deps: FlowDeps, job: FlowInput) -> None:
        self._d = deps
        self._job = job
        self._cfg = deps.config
        self._classifier = PageClassifier(deps.config, deps.adapter)
        self._result = FlowResult()
        self._live = job.mode is RunMode.LIVE
        self._handlers = {
            PageKind.FORM: self._form,
            PageKind.SIGN_IN: self._sign_in,
            PageKind.REGISTER: self._register,
            PageKind.VERIFICATION: self._verification,
            PageKind.JOB: self._job_page,
            PageKind.CONFIRMATION: self._unexpected_confirmation,
            PageKind.ACCOUNT_EXISTS: self._unexpected_wall_error,
            PageKind.SIGN_IN_FAILED: self._unexpected_wall_error,
        }

    def run(self) -> FlowResult:
        try:
            self._open()
            self._walk()
        except Finished as done:
            self._result.stop = done.stop
            self._result.outcome = done.outcome
        except DriverError as error:
            self._driver_failed(error)
        self._capture()
        return self._result

    def _open(self) -> None:
        try:
            self._d.driver.open(self._job.job_url)
        except DriverError as error:
            raise Finished(StopReason.NAVIGATION_FAILED) from error
        self._first_look()

    def _first_look(self) -> None:
        observation = self._observe(job_stage=True)
        stop = STOP_OF_PAGE.get(observation.kind)
        if stop is not None:
            raise Finished(stop)

    def _walk(self) -> None:
        for _ in range(self._cfg.limits.max_pages):
            observation = self._observe(job_stage=False)
            self._result.pages.append(observation.kind)
            stop = STOP_OF_PAGE.get(observation.kind)
            if stop is not None:
                raise Finished(stop)
            self._handlers.get(observation.kind, self._unknown)(observation)
        raise Finished(StopReason.PAGE_LIMIT)

    def _observe(self, job_stage: bool) -> Observation:
        driver = self._d.driver
        snapshot = driver.snapshot(self._classifier.selectors())
        fields = driver.fields()[: self._cfg.limits.max_fields_per_page]
        kind = self._classifier.classify(snapshot, fields, job_stage)
        self._result.captcha_seen = self._result.captcha_seen or kind is PageKind.CAPTCHA
        self._result.final_url = snapshot.url
        self._result.title = snapshot.title
        return Observation(kind, snapshot, fields)

    def _settle(self) -> None:
        self._d.sleep(self._cfg.browser.settle_seconds)

    def _job_page(self, observation: Observation) -> None:
        if not self._d.driver.click_selector(self._adapter_selectors().apply) and not self._d.driver.click_labelled(self._cfg.buttons.apply):
            raise Finished(StopReason.NO_FORM)
        self._settle()

    def _adapter_selectors(self) -> AdapterSelectors:
        return self._d.adapter.selectors if self._d.adapter else AdapterSelectors()

    def _unknown(self, observation: Observation) -> None:
        raise Finished(StopReason.SITE_CHANGED)

    def _unexpected_confirmation(self, observation: Observation) -> None:
        raise Finished(StopReason.SITE_CHANGED)

    def _unexpected_wall_error(self, observation: Observation) -> None:
        raise Finished(StopReason.LOGIN_FAILED)

    def _context(self, facts: dict[Fact, str], password: str | None = None) -> MappingContext:
        job = self._job
        return MappingContext(
            config=self._cfg,
            facts=facts,
            saved_answers=job.saved_answers,
            permissions=job.permissions,
            cover_letter=job.cover_letter,
            has_cv=job.cv is not None,
            password=password,
        )

    def _plan(self, fields: list[FormField], facts: dict[Fact, str], password: str | None = None) -> list[FieldPlan]:
        plans = FieldMapper(self._context(facts, password)).plan(fields)
        self._result.plans.extend(plans)
        return plans

    def _stop_on(self, plans: list[FieldPlan]) -> None:
        blocked = [p for p in plans if p.stop is not None]
        if not blocked:
            return
        self._result.pending = [PendingQuestion(label=p.label, reason=p.stop) for p in blocked if p.stop is not None]
        self._result.prepared = [PreparedAnswer(label=p.label, value=p.value, source=p.source) for p in self._result.plans if p.stop is None and p.value]
        raise Finished(blocked[0].stop)

    def _wall(self, kind: PageKind) -> None:
        self._result.wall = WALL_OF_PAGE[kind]
        if not self._live:
            raise Finished(StopReason.WALL_UNVERIFIED)

    def _sign_in(self, observation: Observation) -> None:
        self._wall(PageKind.SIGN_IN)
        account = self._d.accounts.find(self._job.user_id, self._job.host)
        if account is None:
            self._go_register()
            return
        self._result.account_id = account.id
        if not self._d.accounts.login_allowed(account):
            raise Finished(StopReason.ACCOUNT_NEEDS_ATTENTION)
        self._log_in(observation, account.id)

    def _go_register(self) -> None:
        if not self._creation_allowed():
            raise Finished(StopReason.ACCOUNT_CREATION_NOT_ALLOWED)
        selectors = self._adapter_selectors().register_link
        if not self._d.driver.click_selector(selectors) and not self._d.driver.click_labelled(self._cfg.buttons.create_account):
            raise Finished(StopReason.SITE_CHANGED)
        self._settle()

    def _creation_allowed(self) -> bool:
        permissions = self._job.permissions
        return permissions.allow_account_creation and bool(permissions.account_email)

    def _log_in(self, observation: Observation, account_id: str) -> None:
        accounts = self._d.accounts
        account = accounts.find(self._job.user_id, self._job.host)
        if account is None or account.id != account_id:
            raise Finished(StopReason.SITE_CHANGED)
        password = accounts.password_of(account)
        plans = self._plan(observation.fields, {**self._job.facts, Fact.EMAIL: account.email}, password)
        self._stop_on(plans)
        accounts.record_login_attempt(self._job.user_id, account)
        apply_plans(self._d.driver, observation.fields, plans, FillMaterials(password=password))
        self._press(self._cfg.buttons.sign_in, self._adapter_selectors().submit)
        after = self._observe(job_stage=False)
        if after.kind in {PageKind.SIGN_IN, PageKind.SIGN_IN_FAILED, PageKind.CAPTCHA, PageKind.MFA}:
            accounts.mark_needs_attention(self._job.user_id, account)
            raise Finished(STOP_OF_PAGE.get(after.kind, StopReason.LOGIN_FAILED))
        accounts.mark_signed_in(self._job.user_id, account)

    def _register(self, observation: Observation) -> None:
        self._wall(PageKind.REGISTER)
        existing = self._d.accounts.find(self._job.user_id, self._job.host)
        if existing is not None:
            self._to_sign_in()
            return
        if not self._creation_allowed():
            raise Finished(StopReason.ACCOUNT_CREATION_NOT_ALLOWED)
        email = self._job.permissions.account_email or ""
        account, password = self._d.accounts.create(self._job.user_id, self._job.host, self._job.employer, email, self._job.job_url)
        self._result.account_id = account.id
        plans = self._plan(observation.fields, {**self._job.facts, Fact.EMAIL: email}, password)
        try:
            self._stop_on(plans)
        except Finished:
            self._d.accounts.discard(self._job.user_id, account.id, "portal_registration_not_submitted")
            self._result.account_id = None
            raise
        apply_plans(self._d.driver, observation.fields, plans, FillMaterials(password=password))
        self._press(self._cfg.buttons.create_account, self._adapter_selectors().submit)
        self._after_register(account.id)

    def _after_register(self, account_id: str) -> None:
        after = self._observe(job_stage=False)
        if after.kind is PageKind.ACCOUNT_EXISTS:
            self._d.accounts.discard(self._job.user_id, account_id, "portal_account_already_existed")
            self._result.account_id = None
            raise Finished(StopReason.ACCOUNT_EXISTS)
        if after.kind in STOP_OF_PAGE:
            raise Finished(STOP_OF_PAGE[after.kind])

    def _to_sign_in(self) -> None:
        selectors = self._adapter_selectors().sign_in_link
        if not self._d.driver.click_selector(selectors) and not self._d.driver.click_labelled(self._cfg.buttons.sign_in):
            raise Finished(StopReason.ACCOUNT_EXISTS)
        self._settle()

    def _verification(self, observation: Observation) -> None:
        if not self._live:
            raise Finished(StopReason.VERIFICATION_NEEDED)
        if not self._job.permissions.allow_email_verification:
            raise Finished(StopReason.VERIFICATION_NEEDED)
        hit = self._d.fetch_verification()
        if hit is None:
            raise Finished(StopReason.VERIFICATION_NEEDED)
        if hit.link:
            self._d.driver.open(hit.link)
        else:
            self._enter_code(observation.fields, hit.code or "")
        self._settle()

    def _enter_code(self, fields: list[FormField], code: str) -> None:
        target = next((f for f in fields if f.kind in TEXT_FIELD_KINDS), None)
        if target is None:
            raise Finished(StopReason.VERIFICATION_NEEDED)
        self._d.driver.fill(target.handle, code)
        self._press(self._cfg.buttons.verify, [])

    def _press(self, labels: list[str], selectors: list[str]) -> None:
        if not self._d.driver.click_labelled(labels) and not self._d.driver.click_selector(selectors):
            raise Finished(StopReason.SITE_CHANGED)
        self._settle()

    def _form(self, observation: Observation) -> None:
        plans = self._plan(observation.fields, self._job.facts)
        self._stop_on(plans)
        if not self._live:
            raise Finished(outcome=FlowOutcome.READY)
        self._check_values(plans)
        job = self._job
        materials = FillMaterials(job.cv.name, job.cv.content) if job.cv else FillMaterials()
        apply_plans(self._d.driver, observation.fields, plans, materials)
        if self._submit_present():
            self._submit()
        self._press(self._cfg.buttons.next, self._adapter_selectors().next)

    def _check_values(self, plans: list[FieldPlan]) -> None:
        if any(mentions(p.value, self._cfg.placeholder_markers) for p in plans if p.status is FieldStatus.MAPPED):
            raise Finished(StopReason.CHECK_FAILED)

    def _submit_present(self) -> bool:
        driver = self._d.driver
        return driver.has_labelled(self._cfg.buttons.submit) or driver.has_selector(self._adapter_selectors().submit)

    def _submit(self) -> None:
        self._d.before_submit()
        self._result.submit_clicked = True
        try:
            self._press(self._cfg.buttons.submit, self._adapter_selectors().submit)
            after = self._observe(job_stage=False)
        except (DriverError, Finished):
            raise Finished(outcome=FlowOutcome.UNCERTAIN) from None
        if after.kind is PageKind.CONFIRMATION:
            self._result.confirmation_text = self._evidence_text(after)
            raise Finished(outcome=FlowOutcome.CONFIRMED)
        raise Finished(outcome=FlowOutcome.UNCERTAIN)

    def _evidence_text(self, observation: Observation) -> str:
        limit = self._cfg.limits.max_evidence_chars
        text = observation.snapshot.text
        lowered = text.lower()
        for term in self._cfg.terms_for(PageKind.CONFIRMATION):
            index = lowered.find(term.lower())
            if index >= 0:
                return text[index : index + limit].strip()
        return text[:limit].strip()

    def _capture(self) -> None:
        try:
            self._result.screenshot = self._d.driver.screenshot()
        except DriverError:
            self._result.screenshot = None

    def _driver_failed(self, error: DriverError) -> None:
        self._result.detail = type(error).__name__
        if self._result.submit_clicked:
            self._result.outcome = FlowOutcome.UNCERTAIN
        else:
            self._result.stop = StopReason.NAVIGATION_FAILED
