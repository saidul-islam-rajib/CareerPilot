from dataclasses import dataclass, field
from datetime import date

from careerpilot.candidate.models import Profile
from careerpilot.government.ages import age_on, reached_minimum, within_maximum
from careerpilot.government.models import (
    Circular,
    Criterion,
    ExamRequirement,
    Post,
    PostEligibility,
    Quota,
    QuotaClaim,
)
from careerpilot.platform.config import GovernmentConfig
from careerpilot.platform.enums import (
    AddressKind,
    CriterionKind,
    DistrictBasis,
    Eligibility,
    EligibilityReason,
    QuotaKind,
    SpecialStatus,
)

LIST_SEPARATOR = ","
RANGE_SEPARATOR = "-"


@dataclass(frozen=True)
class ExamRecord:
    exam: str
    scale: str
    result: str
    subject: str


@dataclass
class ProfileFacts:
    born: date | None = None
    citizenship: str = ""
    home_district: str = ""
    permanent_district: str = ""
    present_district: str = ""
    exams: list[ExamRecord] = field(default_factory=list[ExamRecord])
    statuses: dict[SpecialStatus, bool] = field(default_factory=dict[SpecialStatus, bool])


def _date_or_none(value: str) -> date | None:
    try:
        return date.fromisoformat(value.strip())
    except ValueError:
        return None


def _number_or_none(value: str) -> float | None:
    try:
        return float(value.strip())
    except ValueError:
        return None


def _status_of(value: str) -> SpecialStatus | None:
    try:
        return SpecialStatus(value)
    except ValueError:
        return None


class FactReader:
    def __init__(self, config: GovernmentConfig) -> None:
        self._cfg = config.profile

    def read(self, profile: Profile) -> ProfileFacts:
        cfg = self._cfg
        facts = ProfileFacts()
        for entry in profile.active_entries(cfg.identity_section)[:1]:
            facts.born = _date_or_none(entry.text(cfg.birth_date_field))
            facts.citizenship = entry.text(cfg.citizenship_field)
            facts.home_district = entry.text(cfg.home_district_field)
        for entry in profile.active_entries(cfg.address_section):
            district = entry.text(cfg.address_district_field)
            kind = entry.text(cfg.address_kind_field)
            if kind == AddressKind.PERMANENT.value:
                facts.permanent_district = district
            if kind == AddressKind.PRESENT.value:
                facts.present_district = district
        facts.exams = [
            ExamRecord(
                exam=entry.text(cfg.exam_field),
                scale=entry.text(cfg.scale_field),
                result=entry.text(cfg.result_field),
                subject=entry.text(cfg.subject_field),
            )
            for entry in profile.active_entries(cfg.academic_section)
        ]
        for entry in profile.active_entries(cfg.status_section):
            status = _status_of(entry.text(cfg.status_field))
            if status is not None:
                facts.statuses[status] = facts.statuses.get(status, False) or bool(entry.text(cfg.verification_field).strip())
        return facts


def _criterion(kind: CriterionKind, outcome: Eligibility, reason: EligibilityReason, expected: str = "", found: str = "") -> Criterion:
    return Criterion(kind=kind, outcome=outcome, reason=reason, expected=expected, found=found)


class EligibilityChecker:
    def __init__(self, config: GovernmentConfig) -> None:
        self._cfg = config
        self._numeric = set(config.numeric_scales)
        self._ranks = {rank.scale.value: rank.order for rank in config.result_ranks}
        self._quota_statuses = {item.quota: item.statuses for item in config.quota_statuses}

    def check(self, circular: Circular, post: Post, facts: ProfileFacts) -> PostEligibility:
        criteria = [*self._citizenship(post, facts), *self._age(circular, post, facts), *self._education(post, facts)]
        district = self._district(post, facts)
        if district is not None:
            criteria.append(district)
        quotas = [self._quota(quota, post, facts) for quota in post.quotas]
        return PostEligibility(post_id=post.id, overall=self._overall(criteria), criteria=criteria, quotas=quotas)

    @staticmethod
    def _overall(criteria: list[Criterion]) -> Eligibility:
        outcomes = {criterion.outcome for criterion in criteria}
        if Eligibility.NOT_MET in outcomes:
            return Eligibility.NOT_MET
        return Eligibility.UNKNOWN if Eligibility.UNKNOWN in outcomes else Eligibility.MET

    def _citizenship(self, post: Post, facts: ProfileFacts) -> list[Criterion]:
        if not post.requires_citizenship:
            return []
        kind = CriterionKind.CITIZENSHIP
        if not facts.citizenship:
            return [_criterion(kind, Eligibility.UNKNOWN, EligibilityReason.PROFILE_MISSING)]
        if facts.citizenship in self._cfg.profile.citizen_values:
            return [_criterion(kind, Eligibility.MET, EligibilityReason.SATISFIED, found=facts.citizenship)]
        return [_criterion(kind, Eligibility.NOT_MET, EligibilityReason.NOT_A_CITIZEN, found=facts.citizenship)]

    def _age(self, circular: Circular, post: Post, facts: ProfileFacts) -> list[Criterion]:
        rule = post.age
        if rule.min_years is None and rule.max_years is None:
            return []
        kind = CriterionKind.AGE
        expected = f"{rule.min_years or ''}{RANGE_SEPARATOR}{rule.max_years or ''}"
        if facts.born is None:
            return [_criterion(kind, Eligibility.UNKNOWN, EligibilityReason.PROFILE_MISSING, expected)]
        cutoff = circular.age_cutoff_on
        if cutoff is None:
            return [_criterion(kind, Eligibility.UNKNOWN, EligibilityReason.CUTOFF_NOT_STATED, expected)]
        found = age_on(facts.born, cutoff).text()
        if rule.min_years is not None and not reached_minimum(facts.born, cutoff, rule.min_years):
            return [_criterion(kind, Eligibility.NOT_MET, EligibilityReason.BELOW_MINIMUM, expected, found)]
        if rule.max_years is None or within_maximum(facts.born, cutoff, rule.max_years):
            return [_criterion(kind, Eligibility.MET, EligibilityReason.SATISFIED, expected, found)]
        return [self._relaxed(post, facts, cutoff, expected, found)]

    @staticmethod
    def _relaxed(post: Post, facts: ProfileFacts, cutoff: date, expected: str, found: str) -> Criterion:
        kind = CriterionKind.AGE
        assert facts.born is not None
        held = [r for r in post.age.relaxations if r.status in facts.statuses]
        if any(facts.statuses[r.status] and within_maximum(facts.born, cutoff, r.max_years) for r in held):
            return _criterion(kind, Eligibility.MET, EligibilityReason.RELAXATION_APPLIED, expected, found)
        if any(within_maximum(facts.born, cutoff, r.max_years) for r in held):
            return _criterion(kind, Eligibility.UNKNOWN, EligibilityReason.RELAXATION_UNVERIFIED, expected, found)
        return _criterion(kind, Eligibility.NOT_MET, EligibilityReason.ABOVE_MAXIMUM, expected, found)

    def _education(self, post: Post, facts: ProfileFacts) -> list[Criterion]:
        return [self._exam(requirement, facts) for requirement in post.education]

    def _exam(self, requirement: ExamRequirement, facts: ProfileFacts) -> Criterion:
        records = [record for record in facts.exams if record.exam == requirement.exam.value]
        expected = requirement.min_result or ""
        if not records:
            return Criterion(
                kind=CriterionKind.EDUCATION,
                outcome=Eligibility.UNKNOWN,
                reason=EligibilityReason.RECORD_MISSING,
                expected=expected,
                exam=requirement.exam,
            )
        judged = [self._record(requirement, record) for record in records]
        chosen = next((j for j in judged if j[0] is Eligibility.MET), None)
        chosen = chosen or next((j for j in judged if j[0] is Eligibility.UNKNOWN), judged[0])
        outcome, reason, found = chosen
        return Criterion(
            kind=CriterionKind.EDUCATION, outcome=outcome, reason=reason, expected=expected, found=found, exam=requirement.exam
        )

    def _record(self, requirement: ExamRequirement, record: ExamRecord) -> tuple[Eligibility, EligibilityReason, str]:
        found = record.result
        if requirement.subject_keywords:
            if not record.subject.strip():
                return Eligibility.UNKNOWN, EligibilityReason.SUBJECT_MISSING, found
            folded = record.subject.casefold()
            if not any(keyword.casefold() in folded for keyword in requirement.subject_keywords):
                return Eligibility.NOT_MET, EligibilityReason.SUBJECT_MISMATCH, record.subject
        if requirement.min_result is None:
            return Eligibility.MET, EligibilityReason.SATISFIED, found
        if requirement.scale is not None and record.scale != requirement.scale.value:
            return Eligibility.UNKNOWN, EligibilityReason.SCALE_DIFFERS, record.scale
        return self._result(record, requirement.min_result)

    def _result(self, record: ExamRecord, minimum: str) -> tuple[Eligibility, EligibilityReason, str]:
        found = record.result
        if any(record.scale == scale.value for scale in self._numeric):
            have, need = _number_or_none(found), _number_or_none(minimum)
            if have is None or need is None:
                return Eligibility.UNKNOWN, EligibilityReason.SCALE_DIFFERS, found
            met = have >= need
            return (
                (Eligibility.MET, EligibilityReason.SATISFIED, found)
                if met
                else (Eligibility.NOT_MET, EligibilityReason.RESULT_BELOW, found)
            )
        order = self._ranks.get(record.scale)
        folded = [item.casefold() for item in order or []]
        if order is None or found.strip().casefold() not in folded or minimum.strip().casefold() not in folded:
            return Eligibility.UNKNOWN, EligibilityReason.SCALE_DIFFERS, found
        met = folded.index(found.strip().casefold()) >= folded.index(minimum.strip().casefold())
        return (
            (Eligibility.MET, EligibilityReason.SATISFIED, found) if met else (Eligibility.NOT_MET, EligibilityReason.RESULT_BELOW, found)
        )

    @staticmethod
    def _district_of(basis: DistrictBasis, facts: ProfileFacts) -> str:
        if basis is DistrictBasis.PERMANENT_ADDRESS:
            return facts.permanent_district
        if basis is DistrictBasis.PRESENT_ADDRESS:
            return facts.present_district
        return facts.home_district

    def _district(self, post: Post, facts: ProfileFacts) -> Criterion | None:
        if not post.districts:
            return None
        kind = CriterionKind.DISTRICT
        expected = LIST_SEPARATOR.join(post.districts)
        found = self._district_of(post.district_basis, facts)
        if not found:
            return _criterion(kind, Eligibility.UNKNOWN, EligibilityReason.PROFILE_MISSING, expected)
        if found in post.districts:
            return _criterion(kind, Eligibility.MET, EligibilityReason.SATISFIED, expected, found)
        return _criterion(kind, Eligibility.NOT_MET, EligibilityReason.DISTRICT_OUTSIDE, expected, found)

    def _quota(self, quota: Quota, post: Post, facts: ProfileFacts) -> QuotaClaim:
        return QuotaClaim(kind=quota.kind, outcome=self._quota_outcome(quota.kind, post, facts), vacancies=quota.vacancies)

    def _quota_outcome(self, kind: QuotaKind, post: Post, facts: ProfileFacts) -> Eligibility:
        if kind is QuotaKind.GENERAL:
            return Eligibility.MET
        if kind is QuotaKind.DISTRICT:
            district = self._district(post, facts)
            return district.outcome if district is not None else Eligibility.UNKNOWN
        wanted = self._quota_statuses.get(kind, [])
        if any(facts.statuses.get(status, False) for status in wanted):
            return Eligibility.MET
        return Eligibility.UNKNOWN
