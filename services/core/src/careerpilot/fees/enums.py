from enum import StrEnum


class RecordKind(StrEnum):
    RULE = "fee_rule"
    PAYMENT = "payment"


class FeeKind(StrEnum):
    JOB = "job"
    INTERNSHIP = "internship"
    GOVERNMENT = "government"
    SCHOLARSHIP = "scholarship"
    ADMISSION = "admission"
    TEST = "test"
    OTHER = "other"


class PaymentStatus(StrEnum):
    DUE = "due"
    PAID = "paid"
    UNCERTAIN = "uncertain"
    FAILED = "failed"
    REFUNDED = "refunded"
    WAIVED = "waived"


class PaymentAction(StrEnum):
    CONFIRM_PAID = "confirm_paid"
    CONFIRM_NOT_PAID = "confirm_not_paid"
    MARK_UNCERTAIN = "mark_uncertain"
    MARK_FAILED = "mark_failed"
    MARK_REFUNDED = "mark_refunded"
    MARK_WAIVED = "mark_waived"


class ReceiptKind(StrEnum):
    CONFIRMATION_MESSAGE = "confirmation_message"
    RECEIPT_NUMBER = "receipt_number"
    PORTAL_CONFIRMATION = "portal_confirmation"
    BANK_STATEMENT = "bank_statement"


class LineSource(StrEnum):
    FEE_RULE = "fee_rule"
    PAYMENT = "payment"
    GOVERNMENT = "government"


class Urgency(StrEnum):
    NONE = "none"
    OK = "ok"
    DUE_SOON = "due_soon"
    OVERDUE = "overdue"


class ReminderKind(StrEnum):
    DUE_SOON = "due_soon"
    OVERDUE = "overdue"
    CONFIRM_OUTCOME = "confirm_outcome"


class Guidance(StrEnum):
    VERIFY_WITH_PAYEE = "verify_with_payee"
    DO_NOT_PAY_AGAIN = "do_not_pay_again"
    REQUEST_REFUND = "request_refund"
    CHECK_DUPLICATE = "check_duplicate"
    RETRY_AFTER_CHECK = "retry_after_check"
    ADD_RECEIPT = "add_receipt"


class Failure(StrEnum):
    TOO_MANY_ITEMS = "too_many_items"
    EVIDENCE_REQUIRED = "evidence_required"
    DUPLICATE_TRANSACTION = "duplicate_transaction"
    UNSUPPORTED_CURRENCY = "unsupported_currency"
    INVALID_TRANSITION = "invalid_transition"
    UNKNOWN_RULE = "unknown_rule"


class Warning(StrEnum):
    UNVERIFIED_PAYEE = "unverified_payee"
    AMOUNT_DIFFERS = "amount_differs"
    POSSIBLE_DUPLICATE = "possible_duplicate"
    NO_RECEIPT = "no_receipt"
