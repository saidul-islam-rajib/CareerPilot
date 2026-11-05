from dataclasses import dataclass

from careerpilot.portal.config import AdapterConfig, PortalsConfig
from careerpilot.portal.driver import FormField, PageSnapshot
from careerpilot.portal.enums import FieldKind, PageKind

JOB_STAGE_KINDS = (PageKind.CLOSED, PageKind.ALREADY_APPLIED, PageKind.CAPTCHA)
FORM_STAGE_KINDS = (
    PageKind.CAPTCHA,
    PageKind.MFA,
    PageKind.IDENTITY,
    PageKind.ASSESSMENT,
    PageKind.VIDEO,
    PageKind.PAYMENT,
    PageKind.CLOSED,
    PageKind.ALREADY_APPLIED,
)
RESULT_KINDS = (PageKind.CONFIRMATION, PageKind.SIGN_IN_FAILED, PageKind.ACCOUNT_EXISTS, PageKind.VERIFICATION)
PASSWORD_FIELDS_FOR_REGISTER = 2


@dataclass(frozen=True)
class Observation:
    kind: PageKind
    snapshot: PageSnapshot
    fields: list[FormField]


def captcha_selectors(config: PortalsConfig, adapter: AdapterConfig | None) -> list[str]:
    extra = adapter.selectors.captcha if adapter else []
    return [*config.captcha_selectors, *extra]


def confirmation_selectors(adapter: AdapterConfig | None) -> list[str]:
    return list(adapter.selectors.confirmation) if adapter else []


def watched_selectors(config: PortalsConfig, adapter: AdapterConfig | None) -> list[str]:
    return [*captcha_selectors(config, adapter), *confirmation_selectors(adapter)]


def mentions(text: str, terms: list[str]) -> bool:
    lowered = text.lower()
    return any(term.lower() in lowered for term in terms)


def has_any(snapshot: PageSnapshot, selectors: list[str]) -> bool:
    return any(selector in snapshot.present for selector in selectors)


def password_count(fields: list[FormField]) -> int:
    return sum(1 for f in fields if f.kind is FieldKind.PASSWORD)


class PageClassifier:
    def __init__(self, config: PortalsConfig, adapter: AdapterConfig | None) -> None:
        self._config = config
        self._adapter = adapter

    def selectors(self) -> list[str]:
        return watched_selectors(self._config, self._adapter)

    def classify(self, snapshot: PageSnapshot, fields: list[FormField], job_stage: bool) -> PageKind:
        if has_any(snapshot, captcha_selectors(self._config, self._adapter)):
            return PageKind.CAPTCHA
        if has_any(snapshot, confirmation_selectors(self._adapter)):
            return PageKind.CONFIRMATION
        kinds = JOB_STAGE_KINDS if job_stage else (*FORM_STAGE_KINDS, *RESULT_KINDS)
        found = self._first_by_text(snapshot.text, kinds, fields)
        if found is not None:
            return found
        return self._structure(snapshot, fields, job_stage)

    def _first_by_text(self, text: str, kinds: tuple[PageKind, ...], fields: list[FormField]) -> PageKind | None:
        for kind in kinds:
            if not mentions(text, self._config.terms_for(kind)):
                continue
            if kind in {PageKind.ACCOUNT_EXISTS, PageKind.SIGN_IN_FAILED} and password_count(fields) == 0:
                continue
            if kind is PageKind.VERIFICATION and not self._asks_for_code(fields):
                continue
            return kind
        return None

    @staticmethod
    def _asks_for_code(fields: list[FormField]) -> bool:
        return any(f.kind in {FieldKind.TEXT, FieldKind.NUMBER} for f in fields)

    def _structure(self, snapshot: PageSnapshot, fields: list[FormField], job_stage: bool) -> PageKind:
        count = password_count(fields)
        if count >= PASSWORD_FIELDS_FOR_REGISTER or (count and mentions(snapshot.text, self._config.terms_for(PageKind.REGISTER))):
            return PageKind.REGISTER
        if count:
            return PageKind.SIGN_IN
        if any(f.kind is not FieldKind.OTHER for f in fields) and not job_stage:
            return PageKind.FORM
        return PageKind.JOB
