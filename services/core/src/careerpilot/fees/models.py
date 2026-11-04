from pydantic import AwareDatetime, Field

from careerpilot.fees.enums import (
    FeeKind,
    Guidance,
    LineSource,
    PaymentAction,
    PaymentStatus,
    ReceiptKind,
    ReminderKind,
    Urgency,
    Warning,
)
from careerpilot.platform.enums import PaymentMethod
from careerpilot.platform.model import CamelModel

MAX_AMOUNT_FIELD = 10**12


class FeeRuleInput(CamelModel):
    kind: FeeKind
    title: str = Field(min_length=1, max_length=200)
    organization: str = Field(default="", max_length=200)
    opportunity_id: str | None = Field(default=None, max_length=64)
    application_id: str | None = Field(default=None, max_length=64)
    payee: str = Field(default="", max_length=200)
    payee_verified: bool = False
    amount: int = Field(ge=0, le=MAX_AMOUNT_FIELD)
    currency: str = Field(min_length=3, max_length=3)
    purpose: str = Field(default="", max_length=300)
    source_url: str = Field(default="", max_length=500)
    deadline: AwareDatetime | None = None
    waiver_note: str = Field(default="", max_length=500)
    note: str = Field(default="", max_length=1000)


class FeeRule(FeeRuleInput):
    id: str
    user_id: str
    created_at: str


class ReceiptInput(CamelModel):
    kind: ReceiptKind
    reference: str = Field(min_length=1, max_length=300)
    note: str = Field(default="", max_length=500)


class Receipt(ReceiptInput):
    id: str
    added_at: str


class StatusEvent(CamelModel):
    status: PaymentStatus
    at: str
    note: str = ""


class PaymentInput(CamelModel):
    kind: FeeKind = FeeKind.OTHER
    rule_id: str | None = Field(default=None, max_length=64)
    title: str = Field(min_length=1, max_length=200)
    payee: str = Field(default="", max_length=200)
    payee_verified: bool = False
    amount: int = Field(ge=0, le=MAX_AMOUNT_FIELD)
    currency: str = Field(min_length=3, max_length=3)
    purpose: str = Field(default="", max_length=300)
    method: PaymentMethod | None = None
    deadline: AwareDatetime | None = None
    transaction_id: str = Field(default="", max_length=120)
    note: str = Field(default="", max_length=1000)


class Payment(PaymentInput):
    id: str
    user_id: str
    status: PaymentStatus = PaymentStatus.DUE
    paid_at: str | None = None
    receipts: list[Receipt] = Field(default_factory=list[Receipt])
    history: list[StatusEvent] = Field(default_factory=list[StatusEvent])
    created_at: str


class ActionBody(CamelModel):
    action: PaymentAction
    note: str = Field(default="", max_length=500)
    transaction_id: str | None = Field(default=None, max_length=120)
    paid_at: AwareDatetime | None = None
    receipt: ReceiptInput | None = None


class PaymentView(CamelModel):
    payment: Payment
    urgency: Urgency
    warnings: list[Warning]
    guidance: list[Guidance]


class RuleView(CamelModel):
    rule: FeeRule
    urgency: Urgency
    payment_ids: list[str]


class FeeLine(CamelModel):
    source: LineSource
    id: str
    title: str
    organization: str = ""
    kind: FeeKind
    amount: int | None = None
    currency: str = ""
    status: PaymentStatus
    deadline: AwareDatetime | None = None
    urgency: Urgency = Urgency.NONE
    warnings: list[Warning] = Field(default_factory=list[Warning])
    guidance: list[Guidance] = Field(default_factory=list[Guidance])


class Reminder(CamelModel):
    kind: ReminderKind
    source: LineSource
    id: str
    title: str
    deadline: AwareDatetime | None = None


class CurrencyTotal(CamelModel):
    currency: str
    due: int = 0
    uncertain: int = 0
    paid: int = 0


class Overview(CamelModel):
    lines: list[FeeLine]
    reminders: list[Reminder]
    totals: list[CurrencyTotal]


class Reference(CamelModel):
    default_currency: str
    currencies: list[str]
    due_soon_days: int
    max_text_length: int
    max_receipts_per_payment: int
