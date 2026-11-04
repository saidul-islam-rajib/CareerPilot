from careerpilot.fees.context import FeesContext, Stores, urgency_of
from careerpilot.fees.enums import FeeKind, LineSource, PaymentStatus, ReminderKind, Urgency
from careerpilot.fees.models import CurrencyTotal, FeeLine, Overview, PaymentView, Reminder
from careerpilot.fees.payments import PaymentService
from careerpilot.government.models import GovApplicationView
from careerpilot.platform.enums import FeeStatus, FeeUrgency, GovApplicationStatus

GOVERNMENT_STATUS: dict[FeeStatus, PaymentStatus] = {
    FeeStatus.DUE: PaymentStatus.DUE,
    FeeStatus.UNCONFIRMED: PaymentStatus.UNCERTAIN,
    FeeStatus.PAID: PaymentStatus.PAID,
}
GOVERNMENT_URGENCY: dict[FeeUrgency, Urgency] = {
    FeeUrgency.NONE: Urgency.NONE,
    FeeUrgency.OK: Urgency.OK,
    FeeUrgency.DUE_SOON: Urgency.DUE_SOON,
    FeeUrgency.OVERDUE: Urgency.OVERDUE,
}
REMINDER_OF: dict[Urgency, ReminderKind] = {Urgency.DUE_SOON: ReminderKind.DUE_SOON, Urgency.OVERDUE: ReminderKind.OVERDUE}


def deadline_order(line: FeeLine) -> tuple[bool, float]:
    return (line.deadline is None, line.deadline.timestamp() if line.deadline else 0.0)


class OverviewService:
    def __init__(self, context: FeesContext, stores: Stores, payments: PaymentService) -> None:
        self._ctx = context
        self._stores = stores
        self._payments = payments

    def build(self, user_id: str) -> Overview:
        lines = [*self._payment_lines(user_id), *self._rule_lines(user_id), *self._government_lines(user_id)]
        lines.sort(key=deadline_order)
        return Overview(lines=lines, reminders=self._reminders(lines), totals=self._totals(lines))

    def _payment_lines(self, user_id: str) -> list[FeeLine]:
        return [self._line_of(view) for view in self._payments.items(user_id)]

    @staticmethod
    def _line_of(view: PaymentView) -> FeeLine:
        payment = view.payment
        return FeeLine(
            source=LineSource.PAYMENT,
            id=payment.id,
            title=payment.title,
            organization=payment.payee,
            kind=payment.kind,
            amount=payment.amount,
            currency=payment.currency,
            status=payment.status,
            deadline=payment.deadline,
            urgency=view.urgency,
            warnings=view.warnings,
            guidance=view.guidance,
        )

    def _rule_lines(self, user_id: str) -> list[FeeLine]:
        paid_rules = {p.rule_id for p in self._stores.payments.all(user_id) if p.rule_id}
        return [
            FeeLine(
                source=LineSource.FEE_RULE,
                id=rule.id,
                title=rule.title,
                organization=rule.organization or rule.payee,
                kind=rule.kind,
                amount=rule.amount,
                currency=rule.currency,
                status=PaymentStatus.DUE,
                deadline=rule.deadline,
                urgency=urgency_of(self._ctx, PaymentStatus.DUE, rule.deadline),
            )
            for rule in self._stores.rules.all(user_id)
            if rule.id not in paid_rules
        ]

    def _government_lines(self, user_id: str) -> list[FeeLine]:
        return [self._government_line(view) for view in self._ctx.government(user_id) if self._counts(view)]

    @staticmethod
    def _counts(view: GovApplicationView) -> bool:
        return view.status is not GovApplicationStatus.WITHDRAWN and view.fee.status in GOVERNMENT_STATUS

    @staticmethod
    def _government_line(view: GovApplicationView) -> FeeLine:
        return FeeLine(
            source=LineSource.GOVERNMENT,
            id=view.id,
            title=view.circular_title,
            organization=view.authority,
            kind=FeeKind.GOVERNMENT,
            amount=view.fee.amount,
            currency=view.fee.currency,
            status=GOVERNMENT_STATUS[view.fee.status],
            deadline=view.fee.payment_deadline,
            urgency=GOVERNMENT_URGENCY[view.fee_urgency],
        )

    @staticmethod
    def _reminders(lines: list[FeeLine]) -> list[Reminder]:
        found: list[Reminder] = []
        for line in lines:
            kind = REMINDER_OF.get(line.urgency)
            if line.status is PaymentStatus.UNCERTAIN:
                kind = ReminderKind.CONFIRM_OUTCOME
            if kind is not None:
                found.append(Reminder(kind=kind, source=line.source, id=line.id, title=line.title, deadline=line.deadline))
        return found

    @staticmethod
    def _totals(lines: list[FeeLine]) -> list[CurrencyTotal]:
        totals: dict[str, CurrencyTotal] = {}
        for line in lines:
            if line.amount is None or not line.currency:
                continue
            total = totals.setdefault(line.currency, CurrencyTotal(currency=line.currency))
            if line.status is PaymentStatus.DUE:
                total.due += line.amount
            elif line.status is PaymentStatus.UNCERTAIN:
                total.uncertain += line.amount
            elif line.status is PaymentStatus.PAID:
                total.paid += line.amount
        return sorted(totals.values(), key=lambda total: total.currency)
