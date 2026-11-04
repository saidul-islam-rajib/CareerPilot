from datetime import date, timedelta
from typing import TypeVar

from careerpilot.academic.context import ITEM_PREFIX, AcademicContext, Stores, check_size, today
from careerpilot.academic.enums import (
    DeadlineKind,
    DecisionKind,
    Failure,
    StudyKind,
    UserAction,
)
from careerpilot.academic.models import (
    ActionBody,
    ActionRecord,
    BudgetItem,
    ChecklistItem,
    Condition,
    Deadline,
    MessageDraft,
    OfferRow,
    OfferValue,
    PendingItem,
    Plan,
    Program,
    ProgramInput,
)
from careerpilot.academic.planner import ProgramFacts, plan
from careerpilot.platform.errors import conflict, validation_error
from careerpilot.platform.messages import translate

Identified = TypeVar("Identified", BudgetItem, ChecklistItem, Condition, PendingItem)
OFFER_KINDS = frozenset({DecisionKind.ACCEPTED, DecisionKind.CONDITIONALLY_ACCEPTED})
DATE_LENGTH = 10
STUDY_TYPES = {
    "masters": StudyKind.TAUGHT_MASTERS,
    "phd": StudyKind.PHD,
    "scholarship": StudyKind.SCHOLARSHIP,
    "internship": StudyKind.INTERNSHIP,
}
MONTHS_PER_YEAR = 12
MESSAGE_KEYS = {
    UserAction.ACCEPT_OFFER: "academic.messages.acceptOffer",
    UserAction.PAY_DEPOSIT: "academic.messages.payDeposit",
    UserAction.DECLINE_OFFER: "academic.messages.declineOffer",
}


def parse_day(text: str | None) -> date | None:
    try:
        return date.fromisoformat(text[:DATE_LENGTH]) if text else None
    except ValueError:
        return None


class ProgramService:
    def __init__(self, context: AcademicContext, stores: Stores) -> None:
        self._ctx = context
        self._stores = stores

    def items(self, user_id: str) -> list[Program]:
        return self._stores.programs.all(user_id)

    def get(self, user_id: str, program_id: str) -> Program:
        return self._stores.programs.find(user_id, program_id)

    def create(self, user_id: str, data: ProgramInput) -> Program:
        program = Program(id=self._stores.programs.new_id(), user_id=user_id, **self._clean(user_id, data, None).model_dump())
        return self._stores.programs.save(user_id, program.id, program)

    def from_opportunity(self, user_id: str, opportunity_id: str) -> Program:
        if any(p.opportunity_id == opportunity_id for p in self._stores.programs.all(user_id)):
            raise conflict(Failure.DUPLICATE.value)
        detail = self._ctx.opportunities.detail(user_id, opportunity_id)
        kind = STUDY_TYPES.get(detail.type)
        if kind is None:
            raise validation_error(Failure.NOT_A_STUDY_OPPORTUNITY.value)
        deadline = parse_day(detail.deadline)
        data = ProgramInput(
            kind=kind,
            title=detail.title,
            university=detail.organization,
            country_code=detail.country_code,
            source_url=detail.source.url,
            opportunity_id=opportunity_id,
            deadlines=[Deadline(kind=DeadlineKind.APPLICATION, on=deadline, source_url=detail.source.url)] if deadline else [],
        )
        return self.create(user_id, data)

    def update(self, user_id: str, program_id: str, data: ProgramInput) -> Program:
        existing = self.get(user_id, program_id)
        cleaned = self._clean(user_id, data, existing)
        updated = Program(id=existing.id, user_id=user_id, **cleaned.model_dump())
        return self._stores.programs.save(user_id, program_id, updated)

    def remove(self, user_id: str, program_id: str) -> None:
        self.get(user_id, program_id)
        for recommendation in self._stores.recommendations.all(user_id):
            if recommendation.program_id == program_id:
                self._stores.recommendations.remove(user_id, recommendation.id)
        self._stores.programs.remove(user_id, program_id)

    def plan(self, user_id: str, program_id: str) -> Plan:
        return plan(self.facts(user_id, self.get(user_id, program_id)), self._ctx.config)

    def facts(self, user_id: str, program: Program) -> ProgramFacts:
        return ProgramFacts(
            program=program,
            exams=self._stores.exams.all(user_id),
            recommendations=[r for r in self._stores.recommendations.all(user_id) if r.program_id == program.id],
            referees={r.id: r for r in self._stores.referees.all(user_id)},
        )

    def record_action(self, user_id: str, program_id: str, body: ActionBody) -> Program:
        if not body.confirmed:
            raise validation_error(Failure.CONFIRMATION_REQUIRED.value)
        program = self.get(user_id, program_id)
        decision = program.decision
        if decision is None or decision.kind not in OFFER_KINDS:
            raise validation_error(Failure.NOT_AN_OFFER.value)
        decision.actions.append(ActionRecord(action=body.action, confirmed_on=today(self._ctx)))
        return self._stores.programs.save(user_id, program_id, program)

    def message(self, user_id: str, program_id: str, action: UserAction) -> MessageDraft:
        program = self.get(user_id, program_id)
        name = self._ctx.workspaces.get(user_id).profile.full_name
        params = {"name": name, "program": program.title, "university": program.university}
        key = MESSAGE_KEYS[action]
        return MessageDraft(subject=translate(f"{key}.subject", params), body=translate(f"{key}.body", params))

    def generate_checklist(self, user_id: str, program_id: str) -> Program:
        program = self.get(user_id, program_id)
        if program.decision is None or program.decision.kind not in OFFER_KINDS:
            raise validation_error(Failure.NOT_AN_OFFER.value)
        present = {item.step for item in program.checklist}
        for rule in self._ctx.config.checklist_steps:
            if rule.step in present:
                continue
            due = program.starts_on - timedelta(days=rule.lead_days_before_start) if program.starts_on else None
            program.checklist.append(ChecklistItem(id=self._ctx.ids.next(ITEM_PREFIX), step=rule.step, due_on=due))
        return self._stores.programs.save(user_id, program_id, program)

    def compare(self, user_id: str, program_ids: list[str]) -> list[OfferRow]:
        wanted = set(program_ids)
        programs = [p for p in self._stores.programs.all(user_id) if (not wanted or p.id in wanted) and p.decision]
        return [self._offer(p) for p in programs if p.decision and p.decision.kind in OFFER_KINDS]

    def _offer(self, program: Program) -> OfferRow:
        funding = program.funding
        years = funding.duration_months / MONTHS_PER_YEAR if funding.duration_months else None
        costs = [funding.tuition_per_year, funding.living_cost_per_year]
        total = sum(c for c in costs if c is not None) * years if years and all(c is not None for c in costs) else None
        support = funding.funding_per_year * years if funding.funding_per_year is not None and years else None
        net = total - support if total is not None and support is not None else None
        decision = program.decision.kind if program.decision else DecisionKind.PENDING
        return OfferRow(
            program_id=program.id,
            title=program.title,
            university=program.university,
            country_code=program.country_code,
            decision=decision,
            duration_months=program.duration_months or funding.duration_months,
            total_cost=OfferValue(amount=total, estimated=total is not None),
            funding_total=OfferValue(amount=support, estimated=support is not None),
            net_cost=OfferValue(amount=net, estimated=net is not None),
            currency=funding.currency,
        )

    def _clean(self, user_id: str, data: ProgramInput, existing: Program | None) -> ProgramInput:
        check_size(
            self._ctx,
            list(data.deadlines),
            list(data.exam_requirements),
            list(data.credential_requirements),
            list(data.budget),
            list(data.checklist),
            list(data.linked_program_ids),
        )
        owned = {p.id for p in self._stores.programs.all(user_id)}
        own_id = existing.id if existing else None
        if any(linked not in owned or linked == own_id for linked in data.linked_program_ids):
            raise validation_error(Failure.UNKNOWN_PROGRAM.value)
        for invite in data.portal.invites:
            referee = self._stores.referees.get(user_id, invite.referee_id)
            if referee is None or referee.consent_confirmed_on is None:
                raise validation_error(Failure.REFEREE_CONSENT_REQUIRED.value)
            invite.authorized_on = invite.authorized_on or today(self._ctx)
        data.portal.pending_items = [self._with_id(item) for item in data.portal.pending_items]
        data.budget = [self._with_id(item) for item in data.budget]
        data.checklist = [self._with_id(item) for item in data.checklist]
        if data.decision is not None:
            data.decision.conditions = [self._with_id(c) for c in data.decision.conditions]
            data.decision.actions = list(existing.decision.actions) if existing and existing.decision else []
        return data

    def _with_id(self, item: Identified) -> Identified:
        return item if item.id else item.model_copy(update={"id": self._ctx.ids.next(ITEM_PREFIX)})
