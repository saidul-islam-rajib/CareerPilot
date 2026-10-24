from careerpilot.platform.enums import (
    AnswerSource,
    ApplicationMode,
    ApprovalState,
    ContactKind,
    OpportunityDecision,
    OutcomeStatus,
    PauseScope,
    SubmissionStatus,
    SubmissionWindowKind,
    TimelineActor,
)
from careerpilot.platform.model import CamelModel


class UserSummary(CamelModel):
    id: str
    full_name: str
    email: str
    photo_url: str | None = None


class Session(CamelModel):
    access_token: str
    user: UserSummary


class Money(CamelModel):
    amount_minor: int
    currency: str


class MoneyRange(CamelModel):
    min: Money | None = None
    max: Money | None = None
    period: str | None = None


class Track(CamelModel):
    id: str
    kind: str
    name: str | None = None
    result_count: int
    mode: ApplicationMode
    position: int


class OpportunitySummary(CamelModel):
    id: str
    type: str
    title: str
    organization: str
    location: str
    country_code: str
    work_arrangement: str
    match_score: int
    deadline: str | None = None
    compensation: MoneyRange | None = None
    sponsorship: str | None = None
    has_hard_failure: bool
    decision: OpportunityDecision | None = None


class MatchFactor(CamelModel):
    text: str
    positive: bool


class RequirementItem(CamelModel):
    text: str
    check: str
    hard: bool


class ArchivedCircular(CamelModel):
    archived_at: str
    original_url: str
    text: str


class SourceRef(CamelModel):
    name: str
    url: str
    checked_at: str


class OpportunityDetail(OpportunitySummary):
    description: str
    match_factors: list[MatchFactor]
    requirements: list[RequirementItem]
    source: SourceRef
    circular: ArchivedCircular
    route: str

    def summary(self) -> OpportunitySummary:
        return OpportunitySummary.model_validate(self.model_dump(include=set(OpportunitySummary.model_fields)))


class QuestionAnswer(CamelModel):
    id: str
    question: str
    answer: str
    source: AnswerSource


class CvRef(CamelModel):
    name: str
    version: int


class ApprovalMaterials(CamelModel):
    cv: CvRef
    cover_letter: str
    answers: list[QuestionAnswer]


class ApprovalSummary(CamelModel):
    id: str
    opportunity: OpportunitySummary
    state: ApprovalState
    created_at: str
    expires_at: str


class ApprovalDetail(ApprovalSummary):
    route: str
    materials: ApprovalMaterials
    submission_window_label: str | None = None

    def summary(self) -> ApprovalSummary:
        return ApprovalSummary.model_validate(self.model_dump(include=set(ApprovalSummary.model_fields)))


class TimelineEntry(CamelModel):
    at: str
    actor: TimelineActor
    text: str
    status: SubmissionStatus | None = None


class SentEmail(CamelModel):
    subject: str
    to: str
    sent_at: str
    body: str


class SentFile(CamelModel):
    name: str
    version: int
    size_bytes: int


class Evidence(CamelModel):
    text: str
    at: str


class ApplicationSummary(CamelModel):
    id: str
    opportunity: OpportunitySummary
    submission_status: SubmissionStatus
    outcome_status: OutcomeStatus
    applied_at: str | None = None
    updated_at: str
    last_contact_at: str | None = None


class ApplicationRecord(ApplicationSummary):
    route: str
    timeline: list[TimelineEntry]
    questions: list[QuestionAnswer]
    emails: list[SentEmail]
    files: list[SentFile]
    evidence: list[Evidence]
    circular: ArchivedCircular

    def summary(self) -> ApplicationSummary:
        return ApplicationSummary.model_validate(self.model_dump(include=set(ApplicationSummary.model_fields)))


class Contact(CamelModel):
    id: str
    kind: ContactKind
    value: str
    label: str
    is_primary: bool
    verified: bool
    position: int


class Education(CamelModel):
    id: str
    degree: str
    institution: str
    start_year: int
    end_year: int | None = None
    result: str | None = None


class Experience(CamelModel):
    id: str
    title: str
    organization: str
    start: str
    end: str | None = None
    summary: str


class ProfileDocument(CamelModel):
    id: str
    name: str
    version: int
    updated_at: str


class Profile(CamelModel):
    id: str
    full_name: str
    headline: str
    photo_url: str | None = None
    signature_url: str | None = None
    completeness: int
    contacts: list[Contact]
    education: list[Education]
    experience: list[Experience]
    skills: list[str]
    documents: list[ProfileDocument]


class SubmissionWindow(CamelModel):
    kind: SubmissionWindowKind
    start: str | None = None
    end: str | None = None


class PauseState(CamelModel):
    scope: PauseScope
    until: str | None = None
    started_at: str


class Preferences(CamelModel):
    tracks: list[Track]
    submission_window: SubmissionWindow
    pause: PauseState | None = None
    time_zone: str


class SignInEvent(CamelModel):
    id: str
    at: str
    ip: str
    device: str
    approximate_location: str
    success: bool
    current: bool


class DeletionRequest(CamelModel):
    scheduled_for: str


class TrackDigest(CamelModel):
    track: Track
    opportunities: list[OpportunitySummary]


class DashboardCounts(CamelModel):
    new_matches: int
    awaiting_approval: int
    applied_this_week: int
    interviews: int


class DashboardSummary(CamelModel):
    counts: DashboardCounts
    pause: PauseState | None = None
    last_checked_at: str
    tracks: list[TrackDigest]
