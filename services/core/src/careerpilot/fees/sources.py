import re

from careerpilot.fees.config import OpportunityFeeConfig
from careerpilot.fees.enums import Failure, FeeKind
from careerpilot.fees.models import FeeRuleInput, RuleView
from careerpilot.fees.rules import RuleService
from careerpilot.fees.subjects import OpportunityLookup, ProgramLookup
from careerpilot.platform.errors import not_found, validation_error

AMOUNT = r"\d[\d,]*(?:\.\d+)?"
THOUSANDS_SEPARATOR = ","


def _bounded(phrase: str) -> str:
    escaped = re.escape(phrase)
    return rf"(?<![A-Za-z]){escaped}(?![A-Za-z])" if phrase.isalpha() else escaped


def stated_fee(text: str, config: OpportunityFeeConfig, currencies: dict[str, list[str]]) -> tuple[int, str] | None:
    symbols = "|".join(_bounded(p) for codes in currencies.values() for p in sorted(codes, key=len, reverse=True))
    before = re.compile(rf"(?P<cur>{symbols})\s*(?P<amount>{AMOUNT})", re.IGNORECASE)
    after = re.compile(rf"(?P<amount>{AMOUNT})\s*(?P<cur>{symbols})", re.IGNORECASE)
    lowered = text.lower()
    for phrase in config.phrases:
        start = lowered.find(phrase.lower())
        if start < 0:
            continue
        window = text[start + len(phrase) : start + len(phrase) + config.window_chars]
        found = before.search(window) or after.search(window)
        if found is not None:
            code = next(c for c, phrases in currencies.items() if found.group("cur").lower() in [p.lower() for p in phrases])
            return round(float(found.group("amount").replace(THOUSANDS_SEPARATOR, ""))), code
    return None


class FeeSourceService:
    def __init__(
        self,
        rules: RuleService,
        config: OpportunityFeeConfig,
        currencies: dict[str, list[str]],
        opportunities: OpportunityLookup,
        programs: ProgramLookup,
    ) -> None:
        self._rules = rules
        self._config = config
        self._currencies = currencies
        self._opportunities = opportunities
        self._programs = programs

    def from_opportunity(self, user_id: str, opportunity_id: str) -> RuleView:
        existing = self._existing(user_id, opportunity_id=opportunity_id)
        if existing is not None:
            return existing
        subject = self._opportunities(user_id, opportunity_id)
        if subject is None:
            raise not_found("opportunity")
        fee = stated_fee(subject.description, self._config, self._currencies)
        if fee is None:
            raise validation_error(Failure.FEE_NOT_STATED.value)
        amount, currency = fee
        return self._rules.create(
            user_id,
            FeeRuleInput(
                kind=self._config.kind_by_type.get(subject.opportunity_type, FeeKind.OTHER),
                title=subject.title,
                organization=subject.organization,
                opportunity_id=opportunity_id,
                amount=amount,
                currency=currency,
                source_url=subject.source_url,
                deadline=subject.deadline,
            ),
        )

    def from_program(self, user_id: str, program_id: str) -> RuleView:
        existing = self._existing(user_id, program_id=program_id)
        if existing is not None:
            return existing
        subject = self._programs(user_id, program_id)
        if subject is None:
            raise not_found(Failure.UNKNOWN_PROGRAM.value)
        if subject.amount is None or not subject.currency:
            raise validation_error(Failure.FEE_NOT_STATED.value)
        return self._rules.create(
            user_id,
            FeeRuleInput(
                kind=FeeKind.ADMISSION,
                title=subject.title,
                organization=subject.university,
                application_id=program_id,
                amount=round(subject.amount),
                currency=subject.currency,
                source_url=subject.source_url,
                deadline=subject.deadline,
                waiver_note=subject.waiver_note,
            ),
        )

    def _existing(self, user_id: str, opportunity_id: str | None = None, program_id: str | None = None) -> RuleView | None:
        for view in self._rules.items(user_id):
            if (opportunity_id and view.rule.opportunity_id == opportunity_id) or (program_id and view.rule.application_id == program_id):
                return view
        return None
