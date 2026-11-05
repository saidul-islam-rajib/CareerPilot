import pytest

from careerpilot.candidate.models import CompensationRule, Money, MoneyRange, OpportunityMatch
from careerpilot.matching.compensation import extract_compensation, fit_of, is_filtered_out, with_compensation
from careerpilot.platform.config import CompensationConfig
from careerpilot.platform.enums import CompensationFit, CompensationMode, PayPeriod, RangeBasis, RequirementCheck, UnstatedPolicy
from careerpilot.testing import sample_settings

CURRENCY = "BDT"
MINIMUM = 50_000_00
BASE_SCORE = 60


@pytest.fixture
def config() -> CompensationConfig:
    return sample_settings().matching.compensation


def rule(**changes: object) -> CompensationRule:
    base = CompensationRule(minimum=Money(amount_minor=MINIMUM, currency=CURRENCY), period=PayPeriod.MONTHLY)
    return base.model_copy(update=changes)


def offer(low: int, high: int | None = None, period: str | None = "monthly", currency: str = CURRENCY) -> MoneyRange:
    return MoneyRange(
        min=Money(amount_minor=low * 100, currency=currency),
        max=Money(amount_minor=high * 100, currency=currency) if high else None,
        period=period,
    )


def match() -> OpportunityMatch:
    return OpportunityMatch(score=BASE_SCORE, factors=[], requirements=[], has_hard_failure=False, matcher="t", matched_at="now")


def test_extracts_a_range_with_period(config: CompensationConfig) -> None:
    found = extract_compensation("Salary: BDT 40,000 - 60,000 per month, plus bonus", config)
    assert found == offer(40_000, 60_000)


def test_extracts_amount_before_currency_and_yearly_period(config: CompensationConfig) -> None:
    found = extract_compensation("We pay 90,000 USD per year", config)
    assert found == offer(90_000, None, "yearly", "USD")


def test_missing_period_or_amount_is_kept_unclear(config: CompensationConfig) -> None:
    assert extract_compensation("Pay is $5,000", config) == offer(5_000, None, None, "USD")
    assert extract_compensation("Salary negotiable", config) is None


def test_top_of_range_must_meet_minimum(config: CompensationConfig) -> None:
    assert fit_of(offer(40_000, 60_000), rule(), config) is CompensationFit.MEETS
    assert fit_of(offer(40_000, 60_000), rule(basis=RangeBasis.BOTTOM), config) is CompensationFit.BELOW


def test_periods_are_converted(config: CompensationConfig) -> None:
    assert fit_of(offer(700_000, None, "yearly"), rule(), config) is CompensationFit.MEETS
    assert fit_of(offer(500_000, None, "yearly"), rule(), config) is CompensationFit.BELOW


def test_unclear_pay_is_unstated_not_a_failure(config: CompensationConfig) -> None:
    for unclear in (None, offer(10, None, None), offer(10, None, "monthly", "USD")):
        assert fit_of(unclear, rule(), config) is CompensationFit.UNSTATED
    hard = rule(mode=CompensationMode.HARD_FILTER)
    assert not is_filtered_out(CompensationFit.UNSTATED, hard)


def test_hard_filter_excludes_only_pay_below(config: CompensationConfig) -> None:
    hard = rule(mode=CompensationMode.HARD_FILTER)
    assert is_filtered_out(CompensationFit.BELOW, hard)
    assert not is_filtered_out(CompensationFit.BELOW, rule())
    assert not is_filtered_out(CompensationFit.MEETS, hard)


def test_unstated_policy_exclude_filters_and_recommend_only_blocks_automatic(config: CompensationConfig) -> None:
    assert is_filtered_out(CompensationFit.UNSTATED, rule(unstated=UnstatedPolicy.EXCLUDE))
    blocked = with_compensation(match(), None, rule(), config)
    assert blocked.has_hard_failure
    included = with_compensation(match(), None, rule(unstated=UnstatedPolicy.INCLUDE), config)
    assert not included.has_hard_failure
    assert included.requirements[0].check == RequirementCheck.UNKNOWN.value


def test_preference_shifts_score_and_without_minimum_nothing_changes(config: CompensationConfig) -> None:
    assert with_compensation(match(), offer(60_000), rule(), config).score == BASE_SCORE + config.preference_bonus
    assert with_compensation(match(), offer(10_000), rule(), config).score == BASE_SCORE - config.preference_penalty
    assert with_compensation(match(), offer(10_000), CompensationRule(), config) == match()
