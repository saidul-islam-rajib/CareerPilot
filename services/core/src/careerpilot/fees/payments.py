from typing import Any

from careerpilot.fees.context import OPEN_STATUSES, RECEIPT_PREFIX, FeesContext, Stores, check_count, check_money, urgency_of
from careerpilot.fees.enums import Failure, Guidance, PaymentAction, PaymentStatus, Warning
from careerpilot.fees.models import ActionBody, FeeRule, Payment, PaymentInput, PaymentView, Receipt, ReceiptInput, StatusEvent
from careerpilot.platform.clock import iso
from careerpilot.platform.errors import conflict, validation_error

ALLOWED_FROM: dict[PaymentAction, frozenset[PaymentStatus]] = {
    PaymentAction.CONFIRM_PAID: frozenset({PaymentStatus.DUE, PaymentStatus.UNCERTAIN, PaymentStatus.FAILED}),
    PaymentAction.CONFIRM_NOT_PAID: frozenset({PaymentStatus.UNCERTAIN}),
    PaymentAction.MARK_UNCERTAIN: frozenset({PaymentStatus.DUE, PaymentStatus.FAILED}),
    PaymentAction.MARK_FAILED: frozenset({PaymentStatus.DUE, PaymentStatus.UNCERTAIN}),
    PaymentAction.MARK_REFUNDED: frozenset({PaymentStatus.PAID, PaymentStatus.FAILED, PaymentStatus.UNCERTAIN}),
    PaymentAction.MARK_WAIVED: frozenset({PaymentStatus.DUE}),
}
RESULT: dict[PaymentAction, PaymentStatus] = {
    PaymentAction.CONFIRM_PAID: PaymentStatus.PAID,
    PaymentAction.CONFIRM_NOT_PAID: PaymentStatus.DUE,
    PaymentAction.MARK_UNCERTAIN: PaymentStatus.UNCERTAIN,
    PaymentAction.MARK_FAILED: PaymentStatus.FAILED,
    PaymentAction.MARK_REFUNDED: PaymentStatus.REFUNDED,
    PaymentAction.MARK_WAIVED: PaymentStatus.WAIVED,
}
NEEDS_NOTE = frozenset({PaymentAction.MARK_REFUNDED})


class PaymentService:
    def __init__(self, context: FeesContext, stores: Stores) -> None:
        self._ctx = context
        self._stores = stores

    def items(self, user_id: str) -> list[PaymentView]:
        payments = self._stores.payments.all(user_id)
        rules = self._rules(user_id)
        return [self._view(p, rules, payments) for p in payments]

    def get(self, user_id: str, payment_id: str) -> PaymentView:
        return self.view_of(user_id, self._stores.payments.find(user_id, payment_id))

    def view_of(self, user_id: str, payment: Payment) -> PaymentView:
        return self._view(payment, self._rules(user_id), self._stores.payments.all(user_id))

    def create(self, user_id: str, data: PaymentInput) -> PaymentView:
        check_count(self._ctx, len(self._stores.payments.all(user_id)))
        fields = self._checked(user_id, data, None)
        created_at = iso(self._ctx.clock.now())
        payment = Payment(
            id=self._stores.payments.new_id(),
            user_id=user_id,
            created_at=created_at,
            history=[self._event(PaymentStatus.DUE, "")],
            **fields,
        )
        self._stores.payments.save(user_id, payment.id, payment)
        return self.get(user_id, payment.id)

    def from_rule(self, user_id: str, rule_id: str) -> PaymentView:
        rule = self._stores.rules.find(user_id, rule_id)
        data = PaymentInput(
            kind=rule.kind,
            rule_id=rule.id,
            title=rule.title,
            payee=rule.payee,
            payee_verified=rule.payee_verified,
            amount=rule.amount,
            currency=rule.currency,
            purpose=rule.purpose,
            deadline=rule.deadline,
        )
        return self.create(user_id, data)

    def update(self, user_id: str, payment_id: str, data: PaymentInput) -> PaymentView:
        existing = self._stores.payments.find(user_id, payment_id)
        fields = self._checked(user_id, data, payment_id)
        self._stores.payments.save(user_id, payment_id, existing.model_copy(update=fields))
        return self.get(user_id, payment_id)

    def remove(self, user_id: str, payment_id: str) -> None:
        self._stores.payments.find(user_id, payment_id)
        self._stores.payments.remove(user_id, payment_id)

    def act(self, user_id: str, payment_id: str, body: ActionBody) -> PaymentView:
        payment = self._stores.payments.find(user_id, payment_id)
        if payment.status not in ALLOWED_FROM[body.action]:
            raise validation_error(Failure.INVALID_TRANSITION.value)
        if body.action in NEEDS_NOTE and not body.note.strip():
            raise validation_error(Failure.EVIDENCE_REQUIRED.value)
        if body.transaction_id is not None:
            self._check_transaction(user_id, body.transaction_id, payment_id)
            payment.transaction_id = body.transaction_id.strip()
        if body.receipt is not None:
            self._append_receipt(payment, body.receipt)
        if body.action is PaymentAction.CONFIRM_PAID:
            self._confirm_paid(payment, body)
        payment.status = RESULT[body.action]
        payment.history.append(self._event(payment.status, body.note.strip()))
        self._stores.payments.save(user_id, payment_id, payment)
        return self.get(user_id, payment_id)

    def add_receipt(self, user_id: str, payment_id: str, data: ReceiptInput) -> PaymentView:
        payment = self._stores.payments.find(user_id, payment_id)
        self._append_receipt(payment, data)
        self._stores.payments.save(user_id, payment_id, payment)
        return self.get(user_id, payment_id)

    def remove_receipt(self, user_id: str, payment_id: str, receipt_id: str) -> PaymentView:
        payment = self._stores.payments.find(user_id, payment_id)
        payment.receipts = [r for r in payment.receipts if r.id != receipt_id]
        self._stores.payments.save(user_id, payment_id, payment)
        return self.get(user_id, payment_id)

    def _rules(self, user_id: str) -> dict[str, FeeRule]:
        return {rule.id: rule for rule in self._stores.rules.all(user_id)}

    def _checked(self, user_id: str, data: PaymentInput, own_id: str | None) -> dict[str, Any]:
        currency = check_money(self._ctx, data.amount, data.currency)
        if data.rule_id is not None:
            self._stores.rules.find(user_id, data.rule_id)
        transaction_id = data.transaction_id.strip()
        self._check_transaction(user_id, transaction_id, own_id)
        return {**data.model_dump(), "currency": currency, "transaction_id": transaction_id}

    def _check_transaction(self, user_id: str, transaction_id: str, own_id: str | None) -> None:
        key = transaction_id.strip().casefold()
        taken = any(p.id != own_id and p.transaction_id.strip().casefold() == key for p in self._stores.payments.all(user_id))
        if key and taken:
            raise conflict(Failure.DUPLICATE_TRANSACTION.value)

    def _append_receipt(self, payment: Payment, data: ReceiptInput) -> None:
        if len(payment.receipts) >= self._ctx.config.max_receipts_per_payment:
            raise validation_error(Failure.TOO_MANY_ITEMS.value)
        added_at = iso(self._ctx.clock.now())
        payment.receipts.append(Receipt(id=self._ctx.ids.next(RECEIPT_PREFIX), added_at=added_at, **data.model_dump()))

    def _confirm_paid(self, payment: Payment, body: ActionBody) -> None:
        if not payment.receipts and not payment.transaction_id:
            raise validation_error(Failure.EVIDENCE_REQUIRED.value)
        payment.paid_at = iso(body.paid_at or self._ctx.clock.now())

    def _event(self, status: PaymentStatus, note: str) -> StatusEvent:
        return StatusEvent(status=status, at=iso(self._ctx.clock.now()), note=note)

    def _view(self, payment: Payment, rules: dict[str, FeeRule], payments: list[Payment]) -> PaymentView:
        warnings = self._warnings(payment, rules, payments)
        return PaymentView(
            payment=payment,
            urgency=urgency_of(self._ctx, payment.status, payment.deadline),
            warnings=warnings,
            guidance=self._guidance(payment, warnings),
        )

    def _warnings(self, payment: Payment, rules: dict[str, FeeRule], payments: list[Payment]) -> list[Warning]:
        found: list[Warning] = []
        if payment.status in OPEN_STATUSES and not payment.payee_verified:
            found.append(Warning.UNVERIFIED_PAYEE)
        rule = rules.get(payment.rule_id) if payment.rule_id else None
        if rule is not None and (rule.amount, rule.currency) != (payment.amount, payment.currency):
            found.append(Warning.AMOUNT_DIFFERS)
        if payment.status is PaymentStatus.PAID:
            if not payment.receipts:
                found.append(Warning.NO_RECEIPT)
            if self._duplicated(payment, payments):
                found.append(Warning.POSSIBLE_DUPLICATE)
        return found

    @staticmethod
    def _duplicated(payment: Payment, payments: list[Payment]) -> bool:
        return payment.rule_id is not None and any(
            other.id != payment.id and other.rule_id == payment.rule_id and other.status is PaymentStatus.PAID for other in payments
        )

    def _guidance(self, payment: Payment, warnings: list[Warning]) -> list[Guidance]:
        steps = [s for s in self._ctx.config.steps_for(payment.status) if s is not Guidance.CHECK_DUPLICATE]
        if Warning.POSSIBLE_DUPLICATE in warnings:
            steps.extend([Guidance.CHECK_DUPLICATE, Guidance.REQUEST_REFUND])
        if Warning.NO_RECEIPT in warnings and Guidance.ADD_RECEIPT not in steps:
            steps.append(Guidance.ADD_RECEIPT)
        return steps
