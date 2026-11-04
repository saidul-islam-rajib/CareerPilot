from dataclasses import dataclass
from datetime import date, timedelta

from careerpilot.academic.context import AcademicContext, Stores, today
from careerpilot.academic.enums import AttentionKind, DeadlineKind, PortalSubmission, ProgramStatus
from careerpilot.academic.exams import CredentialService, ExamService
from careerpilot.academic.models import (
    AttentionItem,
    ExamReference,
    Outreach,
    Overview,
    Program,
    Reference,
    UpcomingDeadline,
)
from careerpilot.academic.outreach import NEEDS_ATTENTION, OutreachService
from careerpilot.academic.planner import blockers, exam_warnings, referee_warnings
from careerpilot.academic.programs import ProgramService
from careerpilot.academic.referees import RefereeService


class OverviewService:
    def __init__(self, context: AcademicContext, stores: Stores, programs: ProgramService) -> None:
        self._ctx = context
        self._stores = stores
        self._programs = programs

    def build(self, user_id: str) -> Overview:
        active = [p for p in self._programs.items(user_id) if p.status is not ProgramStatus.WITHDRAWN]
        facts = [self._programs.facts(user_id, p) for p in active]
        warnings = [w for f in facts for w in [*exam_warnings(f, self._ctx.config), *referee_warnings(f)]]
        upcoming = self._upcoming(user_id, active)
        attention = [
            *(AttentionItem(kind=AttentionKind.OUTREACH_REPLY, record_id=o.id, program_id=o.program_id) for o in self._replies(user_id)),
            *(AttentionItem(kind=AttentionKind.SCORE_WARNING, program_id=w.program_id, on=w.on) for w in warnings),
            *(
                AttentionItem(kind=AttentionKind.PORTAL_BLOCKED, program_id=f.program.id)
                for f in facts
                if f.program.portal.submission is PortalSubmission.IN_PROGRESS and blockers(f)
            ),
            *(AttentionItem(kind=AttentionKind.DEADLINE_SOON, program_id=u.program_id, on=u.on) for u in upcoming[: len(active)]),
        ]
        order = {kind: index for index, kind in enumerate(self._ctx.config.attention_order)}
        attention.sort(key=lambda item: order.get(item.kind, len(order)))
        return Overview(programs=len(active), attention=attention, upcoming=upcoming, warnings=warnings)

    def _replies(self, user_id: str) -> list[Outreach]:
        return [o for o in self._stores.outreach.all(user_id) if o.status in NEEDS_ATTENTION]

    def _upcoming(self, user_id: str, programs: list[Program]) -> list[UpcomingDeadline]:
        first = today(self._ctx)
        last = first + timedelta(days=self._ctx.config.upcoming_days)
        found = [UpcomingDeadline(program_id=p.id, kind=d.kind, on=d.on) for p in programs for d in p.deadlines if first <= d.on <= last]
        for program in programs:
            found.extend(self._decision_dates(program, first, last))
        for exam in self._stores.exams.all(user_id):
            pairs = [(DeadlineKind.TEST_REGISTRATION, exam.registration_deadline), (DeadlineKind.TEST_DATE, exam.test_on)]
            found.extend(UpcomingDeadline(kind=kind, on=on) for kind, on in pairs if on is not None and first <= on <= last)
        return sorted(found, key=lambda item: item.on)

    def _decision_dates(self, program: Program, first: date, last: date) -> list[UpcomingDeadline]:
        decision = program.decision
        if decision is None:
            return []
        pairs = [(DeadlineKind.ACCEPTANCE, decision.acceptance_deadline), (DeadlineKind.DEPOSIT, decision.deposit_deadline)]
        pairs.extend((DeadlineKind.CONDITION, c.due) for c in decision.conditions if not c.met)
        return [UpcomingDeadline(program_id=program.id, kind=k, on=d) for k, d in pairs if d is not None and first <= d <= last]


@dataclass(frozen=True)
class AcademicServices:
    programs: ProgramService
    exams: ExamService
    credentials: CredentialService
    referees: RefereeService
    outreach: OutreachService
    overview: OverviewService
    reference: Reference


def reference_for(context: AcademicContext) -> Reference:
    config = context.config
    return Reference(
        currency=config.currency,
        exams=[ExamReference(kind=e.kind, sections=e.sections, validity_months=e.validity_months) for e in config.exams],
        max_per_day=config.outreach.max_per_day,
        max_per_department=config.outreach.max_per_department,
        max_per_university=config.outreach.max_per_university,
        follow_ups_allowed=config.outreach.follow_ups_allowed,
        checklist_steps=[rule.step for rule in config.checklist_steps],
        max_text_length=config.max_text_length,
    )


def build_academic(context: AcademicContext) -> AcademicServices:
    stores = Stores(context)
    programs = ProgramService(context, stores)
    return AcademicServices(
        programs=programs,
        exams=ExamService(context, stores),
        credentials=CredentialService(context, stores),
        referees=RefereeService(context, stores),
        outreach=OutreachService(context, stores),
        overview=OverviewService(context, stores, programs),
        reference=reference_for(context),
    )
