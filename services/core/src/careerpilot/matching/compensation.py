import re
from functools import cache

from careerpilot.candidate.models import CompensationRule, MatchFactor, Money, MoneyRange, OpportunityMatch, RequirementItem
from careerpilot.platform.config import CompensationConfig
from careerpilot.platform.enums import CompensationFit, CompensationMode, PayPeriod, RangeBasis, RequirementCheck, UnstatedPolicy
from careerpilot.platform.messages import translate

MAX_SCORE = 100
MIN_SCORE = 0
AMOUNT = r"\d[\d,]*(?:\.\d+)?"
RANGE_JOIN = r"\s*(?:-|\u2013|to)\s*"
THOUSANDS_SEPARATOR = ","


def _bounded(phrase: str) -> str:
    escaped = re.escape(phrase)
    return rf"(?<![A-Za-z]){escaped}(?![A-Za-z])" if phrase.isalpha() else escaped


def _alternatives(phrases: list[str]) -> str:
    return "|".join(_bounded(phrase) for phrase in sorted(phrases, key=len, reverse=True))


def _currency_of(phrase: str, config: CompensationConfig) -> str:
    lowered = phrase.lower()
    return next(code for code, phrases in config.currency_phrases.items() if lowered in [p.lower() for p in phrases])


@cache
def _patterns(symbols: str) -> tuple[re.Pattern[str], re.Pattern[str]]:
    edge = rf"(?:{symbols})"
    before = re.compile(rf"(?P<currency>{edge})\s*(?P<low>{AMOUNT})(?:{RANGE_JOIN}(?:{edge}\s*)?(?P<high>{AMOUNT}))?", re.IGNORECASE)
    after = re.compile(rf"(?P<low>{AMOUNT})(?:{RANGE_JOIN}(?P<high>{AMOUNT}))?\s*(?P<currency>{edge})", re.IGNORECASE)
    return before, after


def _symbols(config: CompensationConfig) -> str:
    return _alternatives([phrase for phrases in config.currency_phrases.values() for phrase in phrases])


def _minor(text: str, config: CompensationConfig) -> int:
    return round(float(text.replace(THOUSANDS_SEPARATOR, "")) * config.minor_units)


def _period_in(text: str, config: CompensationConfig) -> str | None:
    lowered = text.lower()
    for period, phrases in config.period_phrases.items():
        if any(phrase.lower() in lowered for phrase in phrases):
            return period
    return None


def extract_compensation(text: str, config: CompensationConfig) -> MoneyRange | None:
    for pattern in _patterns(_symbols(config)):
        found = pattern.search(text)
        if found is None:
            continue
        currency = _currency_of(found.group("currency"), config)
        low = _minor(found.group("low"), config)
        high = found.group("high")
        if low > config.max_amount_minor:
            continue
        upper = _minor(high, config) if high else None
        window = text[found.end() : found.end() + config.period_window_chars]
        return MoneyRange(
            min=Money(amount_minor=low, currency=currency),
            max=Money(amount_minor=upper, currency=currency) if upper is not None else None,
            period=_period_in(window, config),
        )
    return None


def _monthly_factor(period: PayPeriod, config: CompensationConfig) -> float:
    if period is PayPeriod.HOURLY:
        return float(config.hours_per_month)
    if period is PayPeriod.YEARLY:
        return 1 / config.months_per_year
    return 1.0


def _bound(offer: MoneyRange, basis: RangeBasis) -> Money | None:
    if basis is RangeBasis.TOP:
        return offer.max or offer.min
    return offer.min or offer.max


def fit_of(offer: MoneyRange | None, rule: CompensationRule, config: CompensationConfig) -> CompensationFit:
    if offer is None or rule.minimum is None or offer.period is None:
        return CompensationFit.UNSTATED
    bound = _bound(offer, rule.basis)
    if bound is None or bound.currency != rule.minimum.currency or offer.period not in {p.value for p in PayPeriod}:
        return CompensationFit.UNSTATED
    converted = bound.amount_minor * _monthly_factor(PayPeriod(offer.period), config) / _monthly_factor(rule.period, config)
    return CompensationFit.MEETS if converted >= rule.minimum.amount_minor else CompensationFit.BELOW


def is_filtered_out(fit: CompensationFit, rule: CompensationRule) -> bool:
    if rule.minimum is None:
        return False
    if fit is CompensationFit.BELOW:
        return rule.mode is CompensationMode.HARD_FILTER
    return fit is CompensationFit.UNSTATED and rule.unstated is UnstatedPolicy.EXCLUDE


def _check_of(fit: CompensationFit) -> RequirementCheck:
    return {
        CompensationFit.MEETS: RequirementCheck.MET,
        CompensationFit.BELOW: RequirementCheck.NOT_MET,
        CompensationFit.UNSTATED: RequirementCheck.UNKNOWN,
    }[fit]


def _factor_text(fit: CompensationFit) -> MatchFactor:
    key = {
        CompensationFit.MEETS: "matching.compensationMeets",
        CompensationFit.BELOW: "matching.compensationBelow",
        CompensationFit.UNSTATED: "matching.compensationUnstated",
    }[fit]
    return MatchFactor(text=translate(key), positive=fit is CompensationFit.MEETS)


def _score_shift(fit: CompensationFit, rule: CompensationRule, config: CompensationConfig) -> int:
    if rule.mode is not CompensationMode.PREFERENCE:
        return 0
    if fit is CompensationFit.MEETS:
        return config.preference_bonus
    return -config.preference_penalty if fit is CompensationFit.BELOW else 0


def _blocks_automatic(fit: CompensationFit, rule: CompensationRule) -> bool:
    if fit is CompensationFit.BELOW:
        return rule.mode is CompensationMode.HARD_FILTER
    return fit is CompensationFit.UNSTATED and rule.unstated is UnstatedPolicy.RECOMMEND_ONLY


def with_compensation(
    match: OpportunityMatch, offer: MoneyRange | None, rule: CompensationRule, config: CompensationConfig
) -> OpportunityMatch:
    if rule.minimum is None:
        return match
    fit = fit_of(offer, rule, config)
    requirement = RequirementItem(
        text=translate("matching.requirementCompensation"), check=_check_of(fit).value, hard=rule.mode is CompensationMode.HARD_FILTER
    )
    score = max(MIN_SCORE, min(MAX_SCORE, match.score + _score_shift(fit, rule, config)))
    return match.model_copy(
        update={
            "score": score,
            "factors": [*match.factors, _factor_text(fit)],
            "requirements": [*match.requirements, requirement],
            "has_hard_failure": match.has_hard_failure or _blocks_automatic(fit, rule),
        }
    )
