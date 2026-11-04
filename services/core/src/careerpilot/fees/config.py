from pydantic import BaseModel, ConfigDict, Field

from careerpilot.fees.enums import Guidance, PaymentStatus


class FeesBase(BaseModel):
    model_config = ConfigDict(extra="ignore", frozen=True)


class StatusGuidance(FeesBase):
    status: PaymentStatus
    steps: list[Guidance]


class FeesConfig(FeesBase):
    max_text_length: int = Field(gt=0)
    max_items: int = Field(gt=0)
    max_receipts_per_payment: int = Field(gt=0)
    max_amount: int = Field(gt=0)
    due_soon_days: int = Field(gt=0)
    default_currency: str
    currencies: list[str]
    guidance: list[StatusGuidance]

    def steps_for(self, status: PaymentStatus) -> list[Guidance]:
        return next((rule.steps for rule in self.guidance if rule.status is status), list[Guidance]())
