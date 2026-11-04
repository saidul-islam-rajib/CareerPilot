from dataclasses import dataclass

from careerpilot.fees.context import FeesContext, Stores
from careerpilot.fees.models import Reference
from careerpilot.fees.overview import OverviewService
from careerpilot.fees.payments import PaymentService
from careerpilot.fees.rules import RuleService


@dataclass(frozen=True)
class FeesServices:
    rules: RuleService
    payments: PaymentService
    overview: OverviewService
    reference: Reference


def build_fees(context: FeesContext) -> FeesServices:
    stores = Stores(context)
    payments = PaymentService(context, stores)
    config = context.config
    reference = Reference(
        default_currency=config.default_currency,
        currencies=config.currencies,
        due_soon_days=config.due_soon_days,
        max_text_length=config.max_text_length,
        max_receipts_per_payment=config.max_receipts_per_payment,
    )
    return FeesServices(RuleService(context, stores), payments, OverviewService(context, stores, payments), reference)
