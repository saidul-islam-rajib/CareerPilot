from dataclasses import dataclass

from careerpilot.fees.context import FeesContext, Stores
from careerpilot.fees.models import Reference
from careerpilot.fees.overview import OverviewService
from careerpilot.fees.payments import PaymentService
from careerpilot.fees.receipt_files import ReceiptFileService
from careerpilot.fees.rules import RuleService
from careerpilot.fees.sources import FeeSourceService


@dataclass(frozen=True)
class FeesServices:
    rules: RuleService
    payments: PaymentService
    overview: OverviewService
    reference: Reference
    receipt_files: ReceiptFileService
    sources: FeeSourceService


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
        receipt_file_types=config.receipt_files.types,
        receipt_file_max_bytes=config.receipt_files.max_bytes,
    )
    rules = RuleService(context, stores)
    return FeesServices(
        rules,
        payments,
        OverviewService(context, stores, payments),
        reference,
        ReceiptFileService(context, stores, payments),
        FeeSourceService(rules, config.opportunity_fee, context.currency_phrases, context.opportunities, context.programs),
    )
