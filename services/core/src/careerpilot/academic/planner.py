from dataclasses import dataclass
from datetime import date, timedelta

from careerpilot.academic.config import AcademicConfig
from careerpilot.academic.dates import add_months
from careerpilot.academic.enums import (
    AmountSource,
    Blocker,
    BudgetKind,
    DeadlineKind,
    Evidence,
    ExamKind,
    ExamStatus,
    ItemStatus,
    Need,
    PlanStepKind,
    PortalFee,
    ProgramStatus,
    RecommendationStatus,
    SubmissionMethod,
    WarningKind,
)
from careerpilot.academic.models import (
    AcademicWarning,
    BudgetItem,
    CurrencyTotal,
    Exam,
    ExamView,
    Plan,
    PlanStep,
    Program,
    Recommendation,
    Referee,
)

APPLICATION_DEADLINES = (
    DeadlineKind.APPLICATION,
    DeadlineKind.EARLY_DECISION,
    DeadlineKind.PRIORITY,
    DeadlineKind.SCHOLARSHIP_CONSIDERATION,
)
RELEASED = frozenset({ExamStatus.SCORES_RELEASED})
OPEN_RECOMMENDATIONS = frozenset({RecommendationStatus.PLANNED, RecommendationStatus.REQUESTED})


@dataclass(frozen=True)
class ProgramFacts:
    program: Program
    exams: list[Exam]
    recommendations: list[Recommendation]
    referees: dict[str, Referee]


def expires_on(exam: Exam, config: AcademicConfig) -> date | None:
    base = exam.score_release_on or exam.test_on
    if base is None or exam.status is ExamStatus.CANCELLED:
        return None
    months = exam.validity_months or config.exam(exam.exam).validity_months
    return add_months(base, months)


def exam_view(exam: Exam, config: AcademicConfig) -> ExamView:
    return ExamView(**exam.model_dump(), expires_on=expires_on(exam, config))


def earliest_deadline(program: Program) -> date | None:
    dates = [d.on for d in program.deadlines if d.kind in APPLICATION_DEADLINES]
    return min(dates) if dates else None


def _usable(exam: Exam) -> bool:
    return exam.status in RELEASED and exam.scores is not None


def exam_warnings(facts: ProgramFacts, config: AcademicConfig) -> list[AcademicWarning]:
    program = facts.program
    deadline = earliest_deadline(program)
    found: list[AcademicWarning] = []
    for requirement in program.exam_requirements:
        if requirement.need is Need.NOT_REQUIRED:
            continue
        scored = [e for e in facts.exams if e.exam is requirement.exam and _usable(e)]
        expiries = [d for d in (expires_on(e, config) for e in scored) if d is not None]
        if not expiries:
            if requirement.need is Need.REQUIRED:
                found.append(AcademicWarning(kind=WarningKind.NO_VALID_SCORE, program_id=program.id, exam=requirement.exam))
            continue
        latest = max(expiries)
        if deadline is not None and latest < deadline:
            found.append(
                AcademicWarning(kind=WarningKind.SCORE_EXPIRES_BEFORE_DEADLINE, program_id=program.id, exam=requirement.exam, on=latest)
            )
        elif program.starts_on is not None and latest < program.starts_on:
            found.append(
                AcademicWarning(kind=WarningKind.SCORE_EXPIRES_BEFORE_START, program_id=program.id, exam=requirement.exam, on=latest)
            )
    return found


def referee_warnings(facts: ProgramFacts) -> list[AcademicWarning]:
    return [
        AcademicWarning(kind=WarningKind.REFEREE_WITHOUT_CONSENT, program_id=facts.program.id)
        for recommendation in facts.recommendations
        if (referee := facts.referees.get(recommendation.referee_id)) is None or referee.consent_confirmed_on is None
    ][:1]


def warnings(facts: ProgramFacts, config: AcademicConfig) -> list[AcademicWarning]:
    return [*exam_warnings(facts, config), *referee_warnings(facts)]


def blockers(facts: ProgramFacts) -> list[Blocker]:
    program, portal = facts.program, facts.program.portal
    found: list[Blocker] = []
    if any(not section.done for section in portal.sections):
        found.append(Blocker.SECTION_INCOMPLETE)
    if any(not document.uploaded for document in portal.documents):
        found.append(Blocker.DOCUMENT_MISSING)
    if any(_not_consented(facts, r.referee_id) for r in facts.recommendations):
        found.append(Blocker.REFEREE_NOT_CONSENTED)
    invited = {invite.referee_id for invite in portal.invites if invite.invited_on is not None}
    if any(r.method is SubmissionMethod.PORTAL_INVITE and r.referee_id not in invited for r in facts.recommendations):
        found.append(Blocker.REFEREE_NOT_INVITED)
    if portal.fee is PortalFee.DUE:
        found.append(Blocker.FEE_DUE)
    if any(not item.received for item in portal.pending_items):
        found.append(Blocker.INSTITUTION_ITEM_PENDING)
    if any(c.evidence is Evidence.EXPLICIT and c.status is not ItemStatus.DONE for c in program.credential_requirements):
        found.append(Blocker.CREDENTIAL_PENDING)
    return found


def _not_consented(facts: ProgramFacts, referee_id: str) -> bool:
    referee = facts.referees.get(referee_id)
    return referee is None or referee.consent_confirmed_on is None


def _budget_items(facts: ProgramFacts) -> list[BudgetItem]:
    program = facts.program
    items = list(program.budget)
    fee = program.fee
    if fee.amount is not None and not any(item.kind is BudgetKind.APPLICATION_FEE for item in items):
        items.append(BudgetItem(kind=BudgetKind.APPLICATION_FEE, amount=fee.amount, currency=fee.currency or "-", source=fee.source))
    for exam in facts.exams:
        for report in exam.reports:
            if report.program_id == program.id and report.fee_amount is not None:
                items.append(
                    BudgetItem(
                        kind=BudgetKind.SCORE_SENDING,
                        amount=report.fee_amount,
                        currency=report.fee_currency or "-",
                        source=AmountSource.OFFICIAL,
                    )
                )
    return items


def budget_totals(facts: ProgramFacts) -> list[CurrencyTotal]:
    sums: dict[str, dict[AmountSource, float]] = {}
    for item in _budget_items(facts):
        per_source = sums.setdefault(item.currency, {AmountSource.OFFICIAL: 0.0, AmountSource.ESTIMATE: 0.0})
        per_source[item.source] += item.amount
    return [
        CurrencyTotal(
            currency=currency,
            official=per_source[AmountSource.OFFICIAL],
            estimate=per_source[AmountSource.ESTIMATE],
            total=per_source[AmountSource.OFFICIAL] + per_source[AmountSource.ESTIMATE],
        )
        for currency, per_source in sorted(sums.items())
    ]


def _backwards(deadline: date, days: int) -> date:
    return deadline - timedelta(days=days)


def _exam_steps(facts: ProgramFacts, deadline: date, config: AcademicConfig) -> list[PlanStep]:
    steps: list[PlanStep] = []
    for requirement in facts.program.exam_requirements:
        has_score = any(e.exam is requirement.exam and _usable(e) for e in facts.exams)
        if requirement.need is not Need.REQUIRED or has_score:
            continue
        label = requirement.exam.value
        register_on, take_on = _exam_dates(facts, requirement.exam, deadline, config)
        steps.append(
            PlanStep(kind=PlanStepKind.TEST_REGISTRATION, on=register_on, deadline_kind=DeadlineKind.TEST_REGISTRATION, label=label)
        )
        steps.append(PlanStep(kind=PlanStepKind.TAKE_TEST, on=take_on, deadline_kind=DeadlineKind.TEST_DATE, label=label))
    return steps


def _exam_dates(facts: ProgramFacts, kind: ExamKind, deadline: date, config: AcademicConfig) -> tuple[date, date]:
    rule = config.exam(kind)
    planned = next((e for e in facts.exams if e.exam is kind and e.test_on is not None), None)
    fallback = _backwards(deadline, config.plan.score_sending_lead_days + rule.score_release_days)
    take_on = planned.test_on if planned and planned.test_on else fallback
    register_on = (
        planned.registration_deadline if planned and planned.registration_deadline else _backwards(take_on, rule.registration_lead_days)
    )
    return register_on, take_on


def _referee_deadline(facts: ProgramFacts, deadline: date) -> date:
    own = [d.on for d in facts.program.deadlines if d.kind is DeadlineKind.REFEREE]
    return min(own) if own else deadline


def plan(facts: ProgramFacts, config: AcademicConfig) -> Plan:
    program, rule = facts.program, config.plan
    deadline = earliest_deadline(program)
    steps: list[PlanStep] = []
    if deadline is not None:
        steps.extend(_exam_steps(facts, deadline, config))
        steps.append(
            PlanStep(
                kind=PlanStepKind.SEND_SCORES,
                on=_backwards(deadline, rule.score_sending_lead_days),
                deadline_kind=DeadlineKind.APPLICATION,
            )
        )
        steps.append(
            PlanStep(
                kind=PlanStepKind.PREPARE_DOCUMENTS,
                on=_backwards(deadline, rule.documents_lead_days),
                deadline_kind=DeadlineKind.APPLICATION,
            )
        )
        steps.append(
            PlanStep(
                kind=PlanStepKind.REQUEST_REFEREES,
                on=_backwards(_referee_deadline(facts, deadline), rule.referee_request_lead_days),
                deadline_kind=DeadlineKind.REFEREE,
            )
        )
        contact = [d.on for d in program.deadlines if d.kind is DeadlineKind.SUPERVISOR_CONTACT]
        if program.supervisor or contact:
            on = min(contact) if contact else _backwards(deadline, rule.supervisor_contact_lead_days)
            steps.append(PlanStep(kind=PlanStepKind.CONTACT_SUPERVISOR, on=on, deadline_kind=DeadlineKind.SUPERVISOR_CONTACT))
    for separate in sorted((d for d in program.deadlines if d.kind in APPLICATION_DEADLINES), key=lambda d: d.on):
        steps.append(
            PlanStep(
                kind=PlanStepKind.SUBMIT_APPLICATION,
                on=_backwards(separate.on, rule.submit_buffer_days),
                deadline_kind=separate.kind,
            )
        )
    ordered = sorted(steps, key=lambda step: (step.on, step.kind.value))
    done = program.status in (ProgramStatus.SUBMITTED, ProgramStatus.DECIDED, ProgramStatus.WITHDRAWN)
    return Plan(
        program_id=program.id,
        steps=[] if done else ordered,
        warnings=warnings(facts, config),
        budget=budget_totals(facts),
        blockers=blockers(facts),
    )
