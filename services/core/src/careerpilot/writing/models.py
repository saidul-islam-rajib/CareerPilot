from dataclasses import dataclass, field

from pydantic import BaseModel, ConfigDict, Field

from careerpilot.candidate.models import OpportunityDetail, Profile
from careerpilot.platform.model import CamelModel
from careerpilot.writing.enums import DraftSource, DraftStatus, IssueKind, WritingKind, WritingProvider, WritingTone


class Fact(BaseModel):
    model_config = ConfigDict(frozen=True)

    id: str
    label: str
    text: str
    anchors: list[str] = Field(default_factory=list[str])


class FactRef(CamelModel):
    id: str
    label: str


class CheckIssue(CamelModel):
    kind: IssueKind
    text: str = ""
    terms: list[str] = Field(default_factory=list[str])


class CheckReport(CamelModel):
    issues: list[CheckIssue]
    facts_used: list[FactRef]

    @property
    def passed(self) -> bool:
        return not self.issues


class WritingDraft(CamelModel):
    id: str
    user_id: str = Field(exclude=True)
    kind: WritingKind
    opportunity_id: str
    organization: str
    title: str
    version: int
    text: str
    source: DraftSource
    model: str | None = None
    prompt_version: str | None = None
    tone: WritingTone
    instructions: str = ""
    status: DraftStatus
    issues: list[CheckIssue] = Field(default_factory=list[CheckIssue])
    facts_used: list[FactRef] = Field(default_factory=list[FactRef])
    word_count: int
    created_at: str
    attached_approval_ids: list[str] = Field(default_factory=list[str])
    parent_id: str | None = None


class KindStatus(CamelModel):
    kind: WritingKind
    available: bool
    ai_only: bool
    default_words: int
    max_words: int


class WritingStatus(CamelModel):
    provider: WritingProvider
    ai_configured: bool
    model: str | None = None
    kinds: list[KindStatus]
    tones: list[WritingTone]
    default_tone: WritingTone
    max_instruction_chars: int


@dataclass(frozen=True)
class WritingRequest:
    kind: WritingKind
    tone: WritingTone
    max_words: int
    profile: Profile
    facts: list[Fact]
    opportunity: OpportunityDetail
    instructions: str = ""


@dataclass(frozen=True)
class Generated:
    text: str
    source: DraftSource
    model: str | None = None


@dataclass(frozen=True)
class CheckSubject:
    kind: WritingKind
    text: str
    facts: list[Fact]
    opportunity: OpportunityDetail
    other_employers: list[str] = field(default_factory=list[str])
