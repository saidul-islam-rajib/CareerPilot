from datetime import date, datetime

from pydantic import Field

from careerpilot.candidate.models import StoredFile
from careerpilot.platform.enums import (
    BdExam,
    CircularPhase,
    CircularStatus,
    CriterionKind,
    DayKind,
    DeadlineSubject,
    DistrictBasis,
    Eligibility,
    EligibilityReason,
    EvidenceSource,
    FeeStatus,
    FeeUrgency,
    GovApplicationStatus,
    GovStage,
    GuideActor,
    GuideStepKind,
    NoticeKind,
    PaymentMethod,
    QuotaKind,
    ResultScale,
    SecretKind,
    SpecialStatus,
    StageStatus,
)
from careerpilot.platform.model import CamelModel


class AgeRelaxation(CamelModel):
    status: SpecialStatus
    max_years: int = Field(gt=0)


class AgeRule(CamelModel):
    min_years: int | None = Field(default=None, ge=0)
    max_years: int | None = Field(default=None, gt=0)
    relaxations: list[AgeRelaxation] = Field(default_factory=list[AgeRelaxation])


class ExamRequirement(CamelModel):
    exam: BdExam
    scale: ResultScale | None = None
    min_result: str | None = None
    subject_keywords: list[str] = Field(default_factory=list[str])


class Quota(CamelModel):
    kind: QuotaKind
    vacancies: int | None = Field(default=None, ge=0)


class Post(CamelModel):
    id: str = ""
    title: str = Field(min_length=1)
    grade: int | None = Field(default=None, gt=0)
    pay_min: int | None = Field(default=None, ge=0)
    pay_max: int | None = Field(default=None, ge=0)
    vacancies: int | None = Field(default=None, ge=0)
    location: str = ""
    requires_citizenship: bool = True
    age: AgeRule = Field(default_factory=AgeRule)
    education: list[ExamRequirement] = Field(default_factory=list[ExamRequirement])
    quotas: list[Quota] = Field(default_factory=list[Quota])
    districts: list[str] = Field(default_factory=list[str])
    district_basis: DistrictBasis = DistrictBasis.HOME_DISTRICT
    fee_amount: int | None = Field(default=None, ge=0)


class FeeRule(CamelModel):
    amount: int | None = Field(default=None, ge=0)
    method: PaymentMethod | None = None
    window_hours: int | None = Field(default=None, gt=0)


class Notice(CamelModel):
    id: str = ""
    kind: NoticeKind
    title: str = Field(min_length=1)
    url: str = ""
    published_on: date | None = None


class CircularVersion(CamelModel):
    version: int
    fingerprint: str
    captured_at: str
    changed: list[str]
    snapshot: dict[str, object]


class CircularContent(CamelModel):
    authority: str = Field(min_length=1)
    ministry: str = ""
    title: str = Field(min_length=1)
    source_name: str = ""
    source_url: str = ""
    notice_url: str = ""
    apply_url: str = ""
    published_on: date | None = None
    opens_on: date | None = None
    closes_on: date | None = None
    closes_time: str | None = None
    age_cutoff_on: date | None = None
    fee: FeeRule | None = None
    required_documents: list[str] = Field(default_factory=list[str])
    application_method: str = ""
    source_text: str = ""
    posts: list[Post] = Field(default_factory=list[Post])
    notices: list[Notice] = Field(default_factory=list[Notice])


class Circular(CircularContent):
    id: str
    status: CircularStatus = CircularStatus.DRAFT
    version: int = 1
    fingerprint: str = ""
    captured_at: str = ""
    live_removed: bool = False
    versions: list[CircularVersion] = Field(default_factory=list[CircularVersion])


class DayInfo(CamelModel):
    on: date
    kind: DayKind
    name: str = ""


class DeadlineNote(CamelModel):
    subject: DeadlineSubject
    on: date
    kind: DayKind
    holiday_name: str = ""
    outside_office_hours: bool = False
    previous_working_day: date | None = None
    next_working_day: date | None = None


class Holiday(CamelModel):
    id: str
    on: date
    name: str = Field(min_length=1)


class Criterion(CamelModel):
    kind: CriterionKind
    outcome: Eligibility
    reason: EligibilityReason
    expected: str = ""
    found: str = ""
    exam: BdExam | None = None


class QuotaClaim(CamelModel):
    kind: QuotaKind
    outcome: Eligibility
    vacancies: int | None = None


class PostEligibility(CamelModel):
    post_id: str
    overall: Eligibility
    criteria: list[Criterion]
    quotas: list[QuotaClaim]


class PostSummary(CamelModel):
    id: str
    title: str
    grade: int | None = None
    pay_min: int | None = None
    pay_max: int | None = None
    vacancies: int | None = None
    location: str = ""
    eligibility: Eligibility


class CircularSummary(CamelModel):
    id: str
    title: str
    authority: str
    closes_on: date | None = None
    phase: CircularPhase
    amended: bool
    vacancies: int
    posts: list[PostSummary]


class CircularView(CamelModel):
    circular: Circular
    phase: CircularPhase
    amended: bool
    close_note: DeadlineNote | None = None
    grades: list[int]
    posts: list[PostEligibility]


class ListFilters(CamelModel):
    grades: list[int] = Field(default_factory=list[int])
    grade_min: int | None = None
    grade_max: int | None = None
    authority: str | None = None
    location: str | None = None
    phase: CircularPhase | None = None
    eligible_only: bool = False


class FeeRecord(CamelModel):
    amount: int | None = None
    currency: str = ""
    status: FeeStatus = FeeStatus.NOT_REQUIRED
    method: PaymentMethod | None = None
    payment_deadline: datetime | None = None
    evidence_note: str = ""
    confirmed_at: str | None = None


class StageRecord(CamelModel):
    id: str
    stage: GovStage
    status: StageStatus = StageStatus.EXPECTED
    on: date | None = None
    time: str | None = None
    venue: str = ""
    note: str = ""
    notice_url: str = ""
    source: EvidenceSource = EvidenceSource.USER_ENTRY


class ApplicantCopy(StoredFile):
    id: str
    sha256: str


class GovApplication(CamelModel):
    id: str
    user_id: str
    circular_id: str
    circular_version: int
    post_ids: list[str]
    status: GovApplicationStatus = GovApplicationStatus.PREPARING
    submitted_at: str | None = None
    fee: FeeRecord = Field(default_factory=FeeRecord)
    stages: list[StageRecord] = Field(default_factory=list[StageRecord])
    copies: list[ApplicantCopy] = Field(default_factory=list[ApplicantCopy])
    sealed: dict[SecretKind, str] = Field(default_factory=dict[SecretKind, str])
    created_at: str


class CopyView(CamelModel):
    id: str
    file_name: str
    content_type: str
    size_bytes: int
    uploaded_at: str
    url: str


class GovApplicationView(CamelModel):
    id: str
    circular_id: str
    circular_title: str
    authority: str
    circular_version: int
    post_ids: list[str]
    post_titles: list[str]
    status: GovApplicationStatus
    submitted_at: str | None = None
    fee: FeeRecord
    fee_urgency: FeeUrgency
    fee_note: DeadlineNote | None = None
    stages: list[StageRecord]
    copies: list[CopyView]
    secrets_present: list[SecretKind]
    closes_on: date | None = None
    apply_url: str = ""


class GuideStep(CamelModel):
    kind: GuideStepKind
    actor: GuideActor
    done: bool
    link: str = ""


class UpcomingItem(CamelModel):
    application_id: str
    circular_title: str
    subject: DeadlineSubject
    stage: GovStage | None = None
    on: date
    note: DeadlineNote


class GradeInfo(CamelModel):
    grade: int
    pay_min: int
    pay_max: int


class RecurringHoliday(CamelModel):
    month: int
    day: int
    name: str


class RelaxationSuggestion(CamelModel):
    status: SpecialStatus
    max_years: int


class Reference(CamelModel):
    currency: str
    time_zone: str
    grades: list[GradeInfo]
    holidays: list[Holiday]
    recurring_holidays: list[RecurringHoliday]
    weekend_days: list[str]
    office_start: str
    office_end: str
    relaxation_suggestions: list[RelaxationSuggestion]
    default_max_age: int
    copy_types: list[str]
    copy_max_bytes: int


class ConnectorDraft(CamelModel):
    content: CircularContent
    needs_review: bool = True
