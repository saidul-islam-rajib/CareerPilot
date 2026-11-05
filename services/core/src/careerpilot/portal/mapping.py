import re
from dataclasses import dataclass

from careerpilot.candidate.models import SavedAnswer
from careerpilot.platform.enums import AnswerTopic
from careerpilot.portal.config import FactSynonyms, PortalsConfig
from careerpilot.portal.driver import FormField
from careerpilot.portal.enums import Fact, FieldKind, FieldSource, FieldStatus, Intent, StopReason
from careerpilot.portal.models import FieldPlan, Permissions

NON_WORD = re.compile(r"[^\w\s]", re.UNICODE)
SPACES = re.compile(r"\s+")
TEXT_KINDS = frozenset({FieldKind.TEXT, FieldKind.EMAIL, FieldKind.TEL, FieldKind.TEXTAREA, FieldKind.NUMBER, FieldKind.DATE, FieldKind.OTHER})
CHOICE_KINDS = frozenset({FieldKind.SELECT, FieldKind.RADIO})
TOPIC_OF_INTENT = {
    Intent.EXPERIENCE: AnswerTopic.EXPERIENCE,
    Intent.WORK_AUTHORIZATION: AnswerTopic.WORK_AUTHORIZATION,
    Intent.SPONSORSHIP: AnswerTopic.SPONSORSHIP,
    Intent.NOTICE_PERIOD: AnswerTopic.NOTICE_PERIOD,
    Intent.START_DATE: AnswerTopic.START_DATE,
    Intent.SALARY_EXPECTATION: AnswerTopic.SALARY_EXPECTATION,
    Intent.RELOCATION: AnswerTopic.RELOCATION,
    Intent.ELIGIBILITY: AnswerTopic.ELIGIBILITY,
}
INTENT_ORDER = (
    Intent.ATTESTATION,
    Intent.COVER_LETTER,
    Intent.RESUME,
    Intent.EXPERIENCE,
    Intent.WORK_AUTHORIZATION,
    Intent.SPONSORSHIP,
    Intent.NOTICE_PERIOD,
    Intent.START_DATE,
    Intent.SALARY_EXPECTATION,
    Intent.RELOCATION,
    Intent.ELIGIBILITY,
    Intent.DEMOGRAPHIC,
    Intent.CONSENT,
)
STATUS_STOP = {
    FieldStatus.UNKNOWN: StopReason.UNKNOWN_QUESTION,
    FieldStatus.NO_EXACT_CHOICE: StopReason.NO_EXACT_CHOICE,
    FieldStatus.DEMOGRAPHIC: StopReason.DEMOGRAPHIC,
    FieldStatus.ATTESTATION: StopReason.ATTESTATION,
    FieldStatus.UNSUPPORTED: StopReason.UNSUPPORTED_UPLOAD,
    FieldStatus.TERMS_NOT_ALLOWED: StopReason.TERMS_NOT_ALLOWED,
}


def normalise(text: str) -> str:
    return SPACES.sub(" ", NON_WORD.sub(" ", text.lower())).strip()


def has_term(text: str, term: str) -> bool:
    return re.search(rf"\b{re.escape(normalise(term))}\b", normalise(text)) is not None


def has_any_term(text: str, terms: list[str]) -> bool:
    return any(has_term(text, term) for term in terms)


@dataclass(frozen=True)
class MappingContext:
    config: PortalsConfig
    facts: dict[Fact, str]
    saved_answers: list[SavedAnswer]
    permissions: Permissions
    cover_letter: str = ""
    has_cv: bool = False
    password: str | None = None


@dataclass(frozen=True)
class Decision:
    source: FieldSource | None
    status: FieldStatus
    value: str = ""
    intent: Intent | None = None


def intent_of(config: PortalsConfig, field_: FormField) -> Intent | None:
    for intent in INTENT_ORDER:
        if has_any_term(field_.label, config.intent_terms(intent)):
            return intent
    return None


def fact_of(config: PortalsConfig, field_: FormField) -> Fact | None:
    for synonyms in config.facts:
        if matches_fact(synonyms, field_):
            return synonyms.fact
    return None


def matches_fact(synonyms: FactSynonyms, field_: FormField) -> bool:
    tokens = field_.autocomplete.lower().split()
    if any(token in synonyms.autocomplete for token in tokens):
        return True
    if normalise(field_.name).replace(" ", "_") in {normalise(n).replace(" ", "_") for n in synonyms.names} and field_.name:
        return True
    return normalise(field_.label) in {normalise(label) for label in synonyms.labels}


def saved_match(saved: list[SavedAnswer], field_: FormField, intent: Intent | None) -> SavedAnswer | None:
    wanted = normalise(field_.label)
    active = [a for a in saved if a.deleted_at is None]
    exact = [a for a in active if normalise(a.question) == wanted]
    if exact:
        return exact[-1]
    topic = TOPIC_OF_INTENT.get(intent) if intent else None
    same = [a for a in active if topic is not None and a.topic is topic]
    return same[0] if same and len({normalise(a.answer) for a in same}) == 1 else None


def pick_option(config: PortalsConfig, options: tuple[str, ...], answer: str) -> str | None:
    wanted = normalise(answer)
    exact = [o for o in options if normalise(o) == wanted]
    if len(exact) == 1:
        return exact[0]
    for group in (config.positive_answers, config.negative_answers, config.declined_answers):
        if wanted in {normalise(g) for g in group}:
            members = {normalise(g) for g in group}
            hits = [o for o in options if normalise(o) in members]
            return hits[0] if len(hits) == 1 else None
    return None


class FieldMapper:
    def __init__(self, context: MappingContext) -> None:
        self._ctx = context
        self._config = context.config

    def plan(self, fields: list[FormField]) -> list[FieldPlan]:
        return [self._plan_one(f) for f in fields]

    def _plan_one(self, field_: FormField) -> FieldPlan:
        decision = self._decide(field_)
        status = decision.status
        if status in STATUS_STOP and not field_.required and status is not FieldStatus.ATTESTATION:
            status = FieldStatus.SKIPPED
        if status is FieldStatus.ATTESTATION and not field_.required:
            status = FieldStatus.SKIPPED
        if status is FieldStatus.MAPPED and field_.value and normalise(field_.value) != normalise(decision.value):
            status = FieldStatus.CORRECTED
        redacted = "" if field_.kind is FieldKind.PASSWORD else decision.value
        return FieldPlan(
            handle=field_.handle,
            label=field_.label[: self._config.limits.max_label_chars],
            kind=field_.kind,
            required=field_.required,
            source=decision.source,
            status=status,
            value=redacted,
            intent=decision.intent,
            stop=STATUS_STOP.get(status),
        )

    def _decide(self, field_: FormField) -> Decision:
        if field_.kind is FieldKind.PASSWORD:
            return self._password()
        if field_.kind is FieldKind.FILE:
            return self._file(field_)
        intent = intent_of(self._config, field_)
        if intent is Intent.ATTESTATION:
            return Decision(None, FieldStatus.ATTESTATION, intent=intent)
        if field_.kind is FieldKind.CHECKBOX:
            return self._checkbox(field_, intent)
        if intent is Intent.DEMOGRAPHIC:
            return self._saved(field_, intent, FieldStatus.DEMOGRAPHIC)
        return self._by_value(field_, intent)

    def _password(self) -> Decision:
        if self._ctx.password is None:
            return Decision(FieldSource.ACCOUNT, FieldStatus.UNKNOWN)
        return Decision(FieldSource.ACCOUNT, FieldStatus.MAPPED, self._ctx.password)

    def _file(self, field_: FormField) -> Decision:
        intent = intent_of(self._config, field_)
        if intent is Intent.RESUME and self._ctx.has_cv:
            return Decision(FieldSource.DOCUMENT, FieldStatus.MAPPED, "cv", intent)
        status = FieldStatus.UNKNOWN if intent is Intent.RESUME else FieldStatus.UNSUPPORTED
        return Decision(None, status, intent=intent)

    def _checkbox(self, field_: FormField, intent: Intent | None) -> Decision:
        if intent is Intent.CONSENT:
            return self._consent(field_)
        saved = saved_match(self._ctx.saved_answers, field_, intent)
        if saved is None:
            return Decision(None, FieldStatus.UNKNOWN, intent=intent)
        yes = normalise(saved.answer) in {normalise(a) for a in self._config.positive_answers}
        return Decision(FieldSource.SAVED_ANSWER, FieldStatus.MAPPED, "true" if yes else "false", intent)

    def _consent(self, field_: FormField) -> Decision:
        if self.consent_allowed(field_.label):
            return Decision(FieldSource.CONSENT_RULE, FieldStatus.MAPPED, "true", Intent.CONSENT)
        return Decision(None, FieldStatus.TERMS_NOT_ALLOWED, intent=Intent.CONSENT)

    def consent_allowed(self, label: str) -> bool:
        allowed = self._ctx.permissions
        needs_privacy = has_any_term(label, self._config.intent_terms(Intent.PRIVACY))
        needs_terms = has_any_term(label, self._config.intent_terms(Intent.TERMS))
        if not needs_privacy and not needs_terms:
            return allowed.accept_terms
        return (not needs_privacy or allowed.accept_privacy) and (not needs_terms or allowed.accept_terms)

    def _saved(self, field_: FormField, intent: Intent | None, missing: FieldStatus) -> Decision:
        saved = saved_match(self._ctx.saved_answers, field_, intent)
        if saved is None:
            return Decision(None, missing, intent=intent)
        return self._with_options(field_, saved.answer, FieldSource.SAVED_ANSWER, intent)

    def _by_value(self, field_: FormField, intent: Intent | None) -> Decision:
        fact = fact_of(self._config, field_)
        if fact is not None and field_.kind in TEXT_KINDS | CHOICE_KINDS:
            value = self._ctx.facts.get(fact, "")
            if value:
                return self._with_options(field_, value, FieldSource.PROFILE_FACT, intent)
        if intent is Intent.COVER_LETTER and field_.kind is FieldKind.TEXTAREA and self._ctx.cover_letter:
            return Decision(FieldSource.COVER_LETTER, FieldStatus.MAPPED, self._ctx.cover_letter, intent)
        return self._saved(field_, intent, FieldStatus.UNKNOWN)

    def _with_options(self, field_: FormField, answer: str, source: FieldSource, intent: Intent | None) -> Decision:
        if field_.kind not in CHOICE_KINDS:
            return Decision(source, FieldStatus.MAPPED, answer, intent)
        option = pick_option(self._config, field_.options, answer)
        if option is None:
            return Decision(source, FieldStatus.NO_EXACT_CHOICE, answer, intent)
        return Decision(source, FieldStatus.MAPPED, option, intent)
