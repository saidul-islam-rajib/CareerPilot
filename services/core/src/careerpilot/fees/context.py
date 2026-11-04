from collections.abc import Callable
from dataclasses import dataclass
from datetime import datetime, timedelta

from careerpilot.fees.config import FeesConfig
from careerpilot.fees.enums import Failure, PaymentStatus, RecordKind, Urgency
from careerpilot.fees.models import FeeRule, Payment
from careerpilot.fees.ports import FeeRecordRepository
from careerpilot.fees.store import RecordStore
from careerpilot.government.models import GovApplicationView
from careerpilot.platform.clock import Clock, IdGenerator
from careerpilot.platform.errors import validation_error

RULE_PREFIX = "fer"
PAYMENT_PREFIX = "fep"
RECEIPT_PREFIX = "fec"
OPEN_STATUSES = frozenset({PaymentStatus.DUE, PaymentStatus.UNCERTAIN})

GovernmentFees = Callable[[str], list[GovApplicationView]]


@dataclass(frozen=True)
class FeesContext:
    config: FeesConfig
    clock: Clock
    ids: IdGenerator
    records: FeeRecordRepository
    government: GovernmentFees


class Stores:
    def __init__(self, context: FeesContext) -> None:
        self.rules = RecordStore(context.records, RecordKind.RULE, FeeRule, context.ids, RULE_PREFIX)
        self.payments = RecordStore(context.records, RecordKind.PAYMENT, Payment, context.ids, PAYMENT_PREFIX)


def urgency_of(context: FeesContext, status: PaymentStatus, deadline: datetime | None) -> Urgency:
    if status not in OPEN_STATUSES or deadline is None:
        return Urgency.NONE
    now = context.clock.now()
    if deadline < now:
        return Urgency.OVERDUE
    soon = now + timedelta(days=context.config.due_soon_days)
    return Urgency.DUE_SOON if deadline <= soon else Urgency.OK


def check_money(context: FeesContext, amount: int, currency: str) -> str:
    code = currency.strip().upper()
    if code not in context.config.currencies:
        raise validation_error(Failure.UNSUPPORTED_CURRENCY.value)
    if amount > context.config.max_amount:
        raise validation_error("amount")
    return code


def check_count(context: FeesContext, count: int) -> None:
    if count >= context.config.max_items:
        raise validation_error(Failure.TOO_MANY_ITEMS.value)
