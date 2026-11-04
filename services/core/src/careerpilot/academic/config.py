from pydantic import BaseModel, ConfigDict, Field

from careerpilot.academic.enums import AttentionKind, ChecklistStep, ExamKind


class AcademicBase(BaseModel):
    model_config = ConfigDict(extra="ignore", frozen=True)


class ExamRule(AcademicBase):
    kind: ExamKind
    validity_months: int = Field(gt=0)
    sections: list[str]
    registration_lead_days: int = Field(ge=0)
    score_release_days: int = Field(ge=0)


class PlanRule(AcademicBase):
    submit_buffer_days: int = Field(ge=0)
    documents_lead_days: int = Field(gt=0)
    referee_request_lead_days: int = Field(gt=0)
    score_sending_lead_days: int = Field(gt=0)
    supervisor_contact_lead_days: int = Field(gt=0)


class OutreachRule(AcademicBase):
    max_per_day: int = Field(gt=0)
    max_per_department: int = Field(gt=0)
    max_per_university: int = Field(gt=0)
    follow_ups_allowed: bool
    follow_up_gap_days: int = Field(gt=0)
    min_research_reference_length: int = Field(gt=0)
    bad_phrases: list[str]


class ChecklistRule(AcademicBase):
    step: ChecklistStep
    lead_days_before_start: int


class AcademicConfig(AcademicBase):
    max_text_length: int = Field(gt=0)
    max_items_per_list: int = Field(gt=0)
    upcoming_days: int = Field(gt=0)
    currency: str
    exams: list[ExamRule]
    plan: PlanRule
    outreach: OutreachRule
    checklist_steps: list[ChecklistRule]
    attention_order: list[AttentionKind]

    def exam(self, kind: ExamKind) -> ExamRule:
        return next(rule for rule in self.exams if rule.kind is kind)
