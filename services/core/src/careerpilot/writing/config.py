from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from careerpilot.writing.enums import WritingKind, WritingMode, WritingTone

Effort = Literal["low", "medium", "high", "xhigh", "max"]


class WritingBase(BaseModel):
    model_config = ConfigDict(extra="ignore", frozen=True)


class KindConfig(WritingBase):
    kind: WritingKind
    model: str
    effort: Effort
    adaptive_thinking: bool
    max_tokens: int = Field(gt=0)
    default_words: int = Field(gt=0)
    max_words: int = Field(gt=0)
    ai_only: bool
    require_target_mention: bool
    guidance: str


class ChecksConfig(WritingBase):
    min_name_length: int = Field(gt=0)
    placeholder_patterns: list[str]
    first_person: list[str]
    claim_terms: list[str]
    neutral_words: list[str]


class ExperienceFields(WritingBase):
    section: str
    title: str
    organization: str
    ongoing: str
    summary: str


class EducationFields(WritingBase):
    section: str
    degree: str
    institution: str


class CvSection(WritingBase):
    section: str
    heading: str
    title_fields: list[str]
    detail_fields: list[str] = Field(default_factory=list[str])
    body_field: str | None = None
    ongoing_field: str | None = None


class TemplateConfig(WritingBase):
    entries: int = Field(gt=0)
    skills: int = Field(gt=0)
    min_word_length: int = Field(gt=0)
    experience: ExperienceFields
    education: EducationFields
    cv_sections: list[CvSection]


class WritingConfig(WritingBase):
    mode: WritingMode
    api_key_env: str
    prompt_file: str
    prompt_version: str
    default_tone: WritingTone
    max_instruction_chars: int = Field(gt=0)
    max_text_chars: int = Field(gt=0)
    max_versions_per_document: int = Field(gt=0)
    template: TemplateConfig
    kinds: list[KindConfig]
    checks: ChecksConfig

    def kind_rule(self, kind: WritingKind) -> KindConfig:
        return next(rule for rule in self.kinds if rule.kind is kind)
