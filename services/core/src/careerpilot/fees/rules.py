from careerpilot.fees.context import FeesContext, Stores, check_count, check_money, urgency_of
from careerpilot.fees.enums import PaymentStatus
from careerpilot.fees.models import FeeRule, FeeRuleInput, Payment, RuleView
from careerpilot.platform.clock import iso


class RuleService:
    def __init__(self, context: FeesContext, stores: Stores) -> None:
        self._ctx = context
        self._stores = stores

    def items(self, user_id: str) -> list[RuleView]:
        payments = self._stores.payments.all(user_id)
        return [self._view(rule, payments) for rule in self._stores.rules.all(user_id)]

    def get(self, user_id: str, rule_id: str) -> RuleView:
        return self._view(self._stores.rules.find(user_id, rule_id), self._stores.payments.all(user_id))

    def create(self, user_id: str, data: FeeRuleInput) -> RuleView:
        check_count(self._ctx, len(self._stores.rules.all(user_id)))
        currency = check_money(self._ctx, data.amount, data.currency)
        rule = self._build(self._stores.rules.new_id(), user_id, iso(self._ctx.clock.now()), data, currency)
        self._stores.rules.save(user_id, rule.id, rule)
        return self.get(user_id, rule.id)

    def update(self, user_id: str, rule_id: str, data: FeeRuleInput) -> RuleView:
        existing = self._stores.rules.find(user_id, rule_id)
        currency = check_money(self._ctx, data.amount, data.currency)
        rule = self._build(rule_id, user_id, existing.created_at, data, currency)
        self._stores.rules.save(user_id, rule_id, rule)
        return self.get(user_id, rule_id)

    def remove(self, user_id: str, rule_id: str) -> None:
        self._stores.rules.find(user_id, rule_id)
        self._stores.rules.remove(user_id, rule_id)

    @staticmethod
    def _build(rule_id: str, user_id: str, created_at: str, data: FeeRuleInput, currency: str) -> FeeRule:
        identity = {"id": rule_id, "user_id": user_id, "created_at": created_at, "currency": currency}
        return FeeRule.model_validate({**data.model_dump(), **identity})

    def _view(self, rule: FeeRule, payments: list[Payment]) -> RuleView:
        linked = [p for p in payments if p.rule_id == rule.id]
        paid = any(p.status is PaymentStatus.PAID for p in linked)
        status = PaymentStatus.PAID if paid else PaymentStatus.DUE
        return RuleView(rule=rule, urgency=urgency_of(self._ctx, status, rule.deadline), payment_ids=[p.id for p in linked])
