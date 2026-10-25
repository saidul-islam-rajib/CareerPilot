from collections.abc import Callable
from typing import Any, cast

from pydantic import Field, model_validator

from careerpilot.platform.enums import (
    AnswerSource,
    ApplicationMode,
    ApprovalState,
    ContactKind,
    DocumentKind,
    OpportunityDecision,
    OutcomeStatus,
    PauseScope,
    SubmissionStatus,
    SubmissionWindowKind,
    TimelineActor,
)
from careerpilot.platform.files import PDF, SAMPLE_PREFIX
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


class OpportunityMatch(CamelModel):
    score: int
    factors: list[MatchFactor]
    requirements: list[RequirementItem]
    has_hard_failure: bool
    matcher: str
    matched_at: str


class OpportunityDetail(OpportunitySummary):
    description: str
    match_factors: list[MatchFactor]
    requirements: list[RequirementItem]
    source: SourceRef
    circular: ArchivedCircular
    route: str
    application_email: str | None = None

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
    document_id: str | None = None


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
    materials: ApprovalMaterials | None = None
    attempts: int = 0

    def summary(self) -> ApplicationSummary:
        return ApplicationSummary.model_validate(self.model_dump(include=set(ApplicationSummary.model_fields)))


EntryValue = str | int | float | bool | None
LEGACY_EDUCATION = "education"
LEGACY_EXPERIENCE = "experience"
MONTH_LENGTH = 7


class Contact(CamelModel):
    id: str
    kind: ContactKind
    value: str
    label: str
    is_primary: bool
    verified: bool
    position: int
    deleted_at: str | None = None


class ProfileEntry(CamelModel):
    id: str
    position: int
    values: dict[str, EntryValue]
    updated_at: str
    deleted_at: str | None = None

    def text(self, key: str) -> str:
        value = self.values.get(key)
        return "" if value is None else str(value)


class StoredFile(CamelModel):
    key: str
    file_name: str
    content_type: str
    size_bytes: int
    uploaded_at: str


class DocumentVersion(StoredFile):
    version: int


class ProfileDocument(CamelModel):
    id: str
    name: str
    kind: DocumentKind
    position: int
    versions: list[DocumentVersion]
    updated_at: str
    deleted_at: str | None = None

    @property
    def current(self) -> DocumentVersion:
        return self.versions[-1]


class CompletenessItem(CamelModel):
    key: str
    weight: int
    done: bool


def _legacy_entries(
    items: list[dict[str, Any]], convert: Callable[[dict[str, Any]], dict[str, EntryValue]], at: str
) -> list[dict[str, Any]]:
    return [{"id": str(item["id"]), "position": index + 1, "values": convert(item), "updatedAt": at} for index, item in enumerate(items)]


def _legacy_education(item: dict[str, Any]) -> dict[str, EntryValue]:
    keys = {"degree": "degree", "institution": "institution", "startYear": "start_year", "endYear": "end_year", "result": "result"}
    return {target: item[source] for source, target in keys.items() if item.get(source) is not None}


def _legacy_experience(item: dict[str, Any]) -> dict[str, EntryValue]:
    values: dict[str, EntryValue] = {
        "title": item.get("title"),
        "organization": item.get("organization"),
        "start": str(item.get("start", ""))[:MONTH_LENGTH] or None,
        "end": str(item["end"])[:MONTH_LENGTH] if item.get("end") else None,
        "current": not item.get("end"),
        "summary": item.get("summary"),
    }
    return {k: v for k, v in values.items() if v is not None}


def _sample_version(slug: str, item: dict[str, Any], fallback_at: str) -> dict[str, Any]:
    if "key" in item:
        return item
    version = int(item.get("version", 1))
    return {
        "key": f"{SAMPLE_PREFIX}{slug}-v{version}.pdf",
        "fileName": item.get("fileName") or f"{slug}-v{version}.pdf",
        "contentType": item.get("contentType", PDF),
        "sizeBytes": int(item.get("sizeBytes", 0)),
        "uploadedAt": item.get("uploadedAt") or fallback_at,
        "version": version,
    }


def _legacy_documents(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    upgraded: list[dict[str, Any]] = []
    for index, item in enumerate(items):
        slug = str(item["id"]).replace("_", "-")
        versions = item.get("versions") or [{"version": item.get("version", 1), "sizeBytes": item.get("sizeBytes", 0)}]
        domain_versions = sorted((_sample_version(slug, v, item["updatedAt"]) for v in versions), key=lambda v: int(v["version"]))
        upgraded.append(
            {
                "id": item["id"],
                "name": item["name"],
                "kind": item.get("kind", DocumentKind.CV.value),
                "position": item.get("position", index + 1),
                "updatedAt": item["updatedAt"],
                "versions": domain_versions,
                **({"deletedAt": item["deletedAt"]} if item.get("deletedAt") else {}),
            }
        )
    return upgraded


class Profile(CamelModel):
    id: str
    full_name: str
    headline: str
    location: str = ""
    summary: str = ""
    photo: StoredFile | None = None
    photo_url: str | None = None
    signature_url: str | None = None
    completeness: int = 0
    contacts: list[Contact]
    skills: list[str]
    sections: dict[str, list[ProfileEntry]] = Field(default_factory=dict[str, list[ProfileEntry]])
    documents: list[ProfileDocument]

    @model_validator(mode="before")
    @classmethod
    def upgrade_legacy(cls, data: Any) -> Any:
        if not isinstance(data, dict):
            return data
        document = dict(cast("dict[str, Any]", data))
        at = str(document.get("updatedAt", ""))
        sections = dict(cast("dict[str, Any]", document.get("sections") or {}))
        if LEGACY_EXPERIENCE in document:
            sections.setdefault(LEGACY_EXPERIENCE, _legacy_entries(document.pop(LEGACY_EXPERIENCE), _legacy_experience, at))
        if LEGACY_EDUCATION in document:
            sections.setdefault(LEGACY_EDUCATION, _legacy_entries(document.pop(LEGACY_EDUCATION), _legacy_education, at))
        document["sections"] = sections
        document["documents"] = _legacy_documents(list(document.get("documents") or []))
        return document

    def active_contacts(self) -> list[Contact]:
        return sorted((c for c in self.contacts if c.deleted_at is None), key=lambda c: c.position)

    def active_entries(self, section: str) -> list[ProfileEntry]:
        return sorted((e for e in self.sections.get(section, []) if e.deleted_at is None), key=lambda e: e.position)

    def active_documents(self) -> list[ProfileDocument]:
        return sorted((d for d in self.documents if d.deleted_at is None), key=lambda d: d.position)


class SubmissionWindow(CamelModel):
    kind: SubmissionWindowKind
    start: str | None = None
    end: str | None = None


class PauseState(CamelModel):
    scope: PauseScope
    until: str | None = None
    started_at: str


class NotificationPreferences(CamelModel):
    digest_enabled: bool = True
    digest_time: str | None = None


class Preferences(CamelModel):
    tracks: list[Track]
    submission_window: SubmissionWindow
    pause: PauseState | None = None
    time_zone: str
    notifications: NotificationPreferences = Field(default_factory=NotificationPreferences)


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
