from datetime import date

from pydantic import Field

from careerpilot.academic.enums import (
    AgreementStatus,
    AmountSource,
    AttentionKind,
    Blocker,
    BudgetKind,
    ChecklistStep,
    ConversionSource,
    CredentialKind,
    CredentialNeed,
    DeadlineKind,
    DecisionKind,
    Evidence,
    ExamKind,
    ExamStatus,
    FundingStatus,
    GradeScale,
    ItemStatus,
    Need,
    OutreachStatus,
    PlanStepKind,
    PortalFee,
    PortalSubmission,
    ProgramStatus,
    ReceiptEvidence,
    RecommendationStatus,
    ReplyOutcome,
    ScorePolicy,
    StudyKind,
    SubmissionMethod,
    Term,
    UserAction,
    WarningKind,
)
from careerpilot.platform.model import CamelModel


class Deadline(CamelModel):
    kind: DeadlineKind
    on: date
    note: str = ""
    source_url: str = ""


class ExamRequirement(CamelModel):
    exam: ExamKind
    need: Need = Need.NOT_STATED
    evidence: Evidence = Evidence.NOT_STATED
    min_overall: float | None = Field(default=None, ge=0)
    section_minimums: dict[str, float] = Field(default_factory=dict[str, float])
    policy: ScorePolicy = ScorePolicy.NOT_STATED
    policy_evidence: Evidence = Evidence.NOT_STATED
    waiver_described: bool = False
    note: str = ""


class GradeRequirement(CamelModel):
    scale: GradeScale
    minimum: str = ""
    evidence: Evidence = Evidence.NOT_STATED


class CredentialRequirement(CamelModel):
    need: CredentialNeed
    evidence: Evidence = Evidence.NOT_STATED
    cost: float | None = Field(default=None, ge=0)
    days: int | None = Field(default=None, ge=0)
    status: ItemStatus = ItemStatus.TODO
    credential_id: str | None = None
    note: str = ""


class Statement(CamelModel):
    evidence: Evidence = Evidence.NOT_STATED
    note: str = ""


class Funding(CamelModel):
    status: FundingStatus = FundingStatus.NOT_STATED
    tuition_per_year: float | None = Field(default=None, ge=0)
    living_cost_per_year: float | None = Field(default=None, ge=0)
    funding_per_year: float | None = Field(default=None, ge=0)
    duration_months: int | None = Field(default=None, gt=0)
    currency: str = ""
    conditions: str = ""


class FeeInfo(CamelModel):
    amount: float | None = Field(default=None, ge=0)
    currency: str = ""
    source: AmountSource = AmountSource.ESTIMATE
    waiver_note: str = ""
    waiver_conditions: str = ""


class WorkInfo(CamelModel):
    note: str = ""
    source_url: str = ""
    checked_on: date | None = None


class BudgetItem(CamelModel):
    id: str = ""
    kind: BudgetKind
    amount: float = Field(ge=0)
    currency: str = Field(min_length=1)
    source: AmountSource = AmountSource.ESTIMATE
    note: str = ""


class PortalSection(CamelModel):
    name: str = Field(min_length=1)
    done: bool = False


class PortalDocument(CamelModel):
    name: str = Field(min_length=1)
    uploaded: bool = False


class PortalInvite(CamelModel):
    referee_id: str
    authorized_on: date | None = None
    invited_on: date | None = None


class PendingItem(CamelModel):
    id: str = ""
    name: str = Field(min_length=1)
    received: bool = False


class PortalApplication(CamelModel):
    account_label: str = ""
    sections: list[PortalSection] = Field(default_factory=list[PortalSection])
    documents: list[PortalDocument] = Field(default_factory=list[PortalDocument])
    invites: list[PortalInvite] = Field(default_factory=list[PortalInvite])
    fee: PortalFee = PortalFee.NOT_REQUIRED
    fee_evidence: str = ""
    submission: PortalSubmission = PortalSubmission.NOT_STARTED
    submitted_on: date | None = None
    privacy_notice_url: str = ""
    pending_items: list[PendingItem] = Field(default_factory=list[PendingItem])


class Condition(CamelModel):
    id: str = ""
    text: str = Field(min_length=1)
    due: date | None = None
    met: bool = False


class ActionRecord(CamelModel):
    action: UserAction
    confirmed_on: date


class Decision(CamelModel):
    kind: DecisionKind = DecisionKind.PENDING
    decided_on: date | None = None
    conditions: list[Condition] = Field(default_factory=list[Condition])
    acceptance_deadline: date | None = None
    deposit_amount: float | None = Field(default=None, ge=0)
    deposit_currency: str = ""
    deposit_deadline: date | None = None
    deferral_note: str = ""
    scholarship_note: str = ""
    actions: list[ActionRecord] = Field(default_factory=list[ActionRecord])


class ChecklistItem(CamelModel):
    id: str = ""
    step: ChecklistStep
    status: ItemStatus = ItemStatus.TODO
    due_on: date | None = None
    source_url: str = ""
    source_checked_on: date | None = None
    note: str = ""


class ProgramInput(CamelModel):
    kind: StudyKind
    title: str = Field(min_length=1)
    university: str = Field(min_length=1)
    department: str = ""
    degree: str = ""
    field: str = ""
    country_code: str = ""
    campus: str = ""
    supervisor: str = ""
    research_area: str = ""
    term: Term | None = None
    year: int | None = Field(default=None, ge=2000, le=2200)
    starts_on: date | None = None
    duration_months: int | None = Field(default=None, gt=0)
    study_mode: str = ""
    source_url: str = ""
    portal_url: str = ""
    notes: str = ""
    status: ProgramStatus = ProgramStatus.SAVED
    opportunity_id: str | None = None
    linked_program_ids: list[str] = Field(default_factory=list[str])
    deadlines: list[Deadline] = Field(default_factory=list[Deadline])
    exam_requirements: list[ExamRequirement] = Field(default_factory=list[ExamRequirement])
    min_grade: GradeRequirement | None = None
    credential_requirements: list[CredentialRequirement] = Field(default_factory=list[CredentialRequirement])
    equivalence: Statement = Field(default_factory=Statement)
    referees_required: int | None = Field(default=None, ge=0)
    funding: Funding = Field(default_factory=Funding)
    fee: FeeInfo = Field(default_factory=FeeInfo)
    work_info: WorkInfo = Field(default_factory=WorkInfo)
    budget: list[BudgetItem] = Field(default_factory=list[BudgetItem])
    portal: PortalApplication = Field(default_factory=PortalApplication)
    decision: Decision | None = None
    checklist: list[ChecklistItem] = Field(default_factory=list[ChecklistItem])


class Program(ProgramInput):
    id: str
    user_id: str


class FromOpportunity(CamelModel):
    opportunity_id: str


class Scores(CamelModel):
    overall: float | None = Field(default=None, ge=0)
    sections: dict[str, float] = Field(default_factory=dict[str, float])


class ScoreReport(CamelModel):
    id: str = ""
    program_id: str
    institution_code: str = ""
    sent_on: date | None = None
    fee_amount: float | None = Field(default=None, ge=0)
    fee_currency: str = ""
    confirmed_receipt: bool = False
    confirmed_on: date | None = None


class ExamInput(CamelModel):
    exam: ExamKind
    status: ExamStatus = ExamStatus.PLANNED
    registration_deadline: date | None = None
    test_on: date | None = None
    score_release_on: date | None = None
    scores: Scores | None = None
    validity_months: int | None = Field(default=None, gt=0)
    fee_amount: float | None = Field(default=None, ge=0)
    fee_currency: str = ""
    fee_source: AmountSource = AmountSource.ESTIMATE
    reports: list[ScoreReport] = Field(default_factory=list[ScoreReport])
    note: str = ""


class Exam(ExamInput):
    id: str
    user_id: str


class ExamView(Exam):
    expires_on: date | None = None


class CredentialInput(CamelModel):
    kind: CredentialKind
    institution: str = Field(min_length=1)
    title: str = Field(min_length=1)
    scale: GradeScale
    value: str = Field(min_length=1)
    out_of: str = ""
    graduated_year: int | None = Field(default=None, ge=1900, le=2200)
    converted_value: str = ""
    conversion_source: ConversionSource | None = None
    document_name: str = ""
    note: str = ""


class Credential(CredentialInput):
    id: str
    user_id: str


class CredentialView(Credential):
    conversion_is_estimate: bool = False


class RefereeInput(CamelModel):
    name: str = Field(min_length=1)
    email: str = ""
    phone: str = ""
    title: str = ""
    institution: str = ""
    relationship: str = ""


class Referee(RefereeInput):
    id: str
    user_id: str
    consent_confirmed_on: date | None = None


class ConsentBody(CamelModel):
    confirmed: bool


class RecommendationInput(CamelModel):
    referee_id: str
    program_id: str
    requested_on: date | None = None
    agreement: AgreementStatus = AgreementStatus.NOT_ASKED
    method: SubmissionMethod = SubmissionMethod.NOT_STATED
    referee_deadline: date | None = None
    invite_authorized: bool = False
    reminders_sent: list[date] = Field(default_factory=list[date])
    note: str = ""


class Recommendation(RecommendationInput):
    id: str
    user_id: str
    status: RecommendationStatus = RecommendationStatus.PLANNED
    evidence: ReceiptEvidence | None = None
    evidence_note: str = ""
    evidence_on: date | None = None


class EvidenceBody(CamelModel):
    status: RecommendationStatus
    evidence: ReceiptEvidence | None = None
    evidence_note: str = ""
    on: date | None = None


class MessageDraft(CamelModel):
    subject: str
    body: str


class OutreachInput(CamelModel):
    program_id: str | None = None
    supervisor_name: str = Field(min_length=1)
    supervisor_email: str = ""
    university: str = Field(min_length=1)
    department: str = ""
    research_reference: str = ""
    source_url: str = ""
    subject: str = ""
    body: str = ""
    allow_follow_up: bool = False


class Outreach(OutreachInput):
    id: str
    user_id: str
    status: OutreachStatus = OutreachStatus.DRAFT
    drafted_on: date
    sent_on: date | None = None
    last_sent_on: date | None = None
    follow_ups_sent: int = 0
    replied_on: date | None = None
    reply_note: str = ""
    do_not_contact: bool = False


class DraftBody(CamelModel):
    program_id: str | None = None
    supervisor_name: str = Field(min_length=1)
    supervisor_email: str = ""
    university: str = Field(min_length=1)
    department: str = ""
    research_reference: str = ""
    source_url: str = ""


class ReplyBody(CamelModel):
    outcome: ReplyOutcome
    note: str = ""


class SentBody(CamelModel):
    on: date | None = None


class ActionBody(CamelModel):
    action: UserAction
    confirmed: bool = False


class OutreachSettings(CamelModel):
    max_per_day: int | None = Field(default=None, gt=0)
    max_per_department: int | None = Field(default=None, gt=0)
    max_per_university: int | None = Field(default=None, gt=0)
    follow_ups_allowed: bool | None = None


class StoredOutreachSettings(OutreachSettings):
    id: str
    user_id: str


class AcademicWarning(CamelModel):
    kind: WarningKind
    program_id: str
    exam: ExamKind | None = None
    on: date | None = None


class PlanStep(CamelModel):
    kind: PlanStepKind
    on: date
    deadline_kind: DeadlineKind
    label: str = ""


class CurrencyTotal(CamelModel):
    currency: str
    official: float
    estimate: float
    total: float


class Plan(CamelModel):
    program_id: str
    steps: list[PlanStep]
    warnings: list[AcademicWarning]
    budget: list[CurrencyTotal]
    blockers: list[Blocker]


class AttentionItem(CamelModel):
    kind: AttentionKind
    program_id: str | None = None
    record_id: str | None = None
    on: date | None = None


class UpcomingDeadline(CamelModel):
    program_id: str | None = None
    kind: DeadlineKind
    on: date


class Overview(CamelModel):
    programs: int
    attention: list[AttentionItem]
    upcoming: list[UpcomingDeadline]
    warnings: list[AcademicWarning]


class OfferValue(CamelModel):
    amount: float | None = None
    estimated: bool = False


class OfferRow(CamelModel):
    program_id: str
    title: str
    university: str
    country_code: str
    decision: DecisionKind
    duration_months: int | None
    total_cost: OfferValue
    funding_total: OfferValue
    net_cost: OfferValue
    currency: str


class ExamReference(CamelModel):
    kind: ExamKind
    sections: list[str]
    validity_months: int


class Reference(CamelModel):
    currency: str
    exams: list[ExamReference]
    max_per_day: int
    max_per_department: int
    max_per_university: int
    follow_ups_allowed: bool
    checklist_steps: list[ChecklistStep]
    max_text_length: int
