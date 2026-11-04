import {
  AmountSource,
  AttentionKind,
  ChecklistStep,
  DeadlineKind,
  DecisionKind,
  ExamKind,
  ExamStatus,
  ItemProgress,
  NeedLevel,
  OutreachStatus,
  PlanStepKind,
  PortalBlocker,
  PortalFee,
  PortalSubmission,
  ReceiptEvidence,
  RecommendationStatus,
  ReplyOutcome,
  StudyKind,
  SubmissionMethod,
  UserAction,
  WarningKind,
  AcademicFailure,
  type DraftKind,
} from '@careerpilot/domain-ui-logic';
import { ApiErrorCode } from '../errors';
import type { Clock, IdGenerator } from '../ports';
import type { OpportunityDetail } from '../types';
import { emptyProgramInput } from './defaults';
import type { AcademicApi } from './ports';
import type {
  AcademicReference,
  AcademicWarning,
  Credential,
  Exam,
  Outreach,
  OutreachSettings,
  Plan,
  PlanStep,
  Program,
  Recommendation,
  Referee,
} from './types';

const MS_PER_DAY = 86_400_000;
const DATE_LENGTH = 10;
const MONTHS_PER_YEAR = 12;
const LIMITS = {
  maxPerDay: 5,
  maxPerDepartment: 3,
  maxPerUniversity: 6,
  followUpGapDays: 10,
  minReference: 12,
};
const VALIDITY_MONTHS: Record<ExamKind, number> = {
  [ExamKind.Ielts]: 24,
  [ExamKind.Toefl]: 24,
  [ExamKind.Pte]: 24,
  [ExamKind.Duolingo]: 24,
  [ExamKind.Gre]: 60,
  [ExamKind.Gmat]: 60,
  [ExamKind.Sat]: 60,
  [ExamKind.Act]: 60,
  [ExamKind.Other]: 24,
};
const CHECKLIST_LEAD_DAYS: Record<ChecklistStep, number> = {
  [ChecklistStep.AdmissionDocument]: 120,
  [ChecklistStep.ProofOfFunds]: 110,
  [ChecklistStep.Visa]: 90,
  [ChecklistStep.HealthInsurance]: 45,
  [ChecklistStep.Accommodation]: 60,
  [ChecklistStep.TuitionPayment]: 30,
  [ChecklistStep.Travel]: 14,
  [ChecklistStep.ArrivalRegistration]: -7,
};
const OPPORTUNITY_KINDS: Record<string, StudyKind> = {
  masters: StudyKind.TaughtMasters,
  phd: StudyKind.Phd,
  scholarship: StudyKind.Scholarship,
  internship: StudyKind.Internship,
};
const OFFERS: readonly DecisionKind[] = [DecisionKind.Accepted, DecisionKind.ConditionallyAccepted];
const STOPPING: readonly OutreachStatus[] = [OutreachStatus.Declined, OutreachStatus.Stopped];
const REPLY_STATUS: Record<ReplyOutcome, OutreachStatus> = {
  [ReplyOutcome.Positive]: OutreachStatus.RepliedPositive,
  [ReplyOutcome.CallRequested]: OutreachStatus.CallRequested,
  [ReplyOutcome.DocumentsRequested]: OutreachStatus.DocumentsRequested,
  [ReplyOutcome.Neutral]: OutreachStatus.RepliedNeutral,
  [ReplyOutcome.Declined]: OutreachStatus.Declined,
  [ReplyOutcome.DoNotContact]: OutreachStatus.Stopped,
};
const NEEDS_ATTENTION: readonly OutreachStatus[] = [OutreachStatus.RepliedPositive, OutreachStatus.CallRequested, OutreachStatus.DocumentsRequested];
const EARLY_KINDS: readonly DeadlineKind[] = [
  DeadlineKind.Application,
  DeadlineKind.EarlyDecision,
  DeadlineKind.Priority,
  DeadlineKind.ScholarshipConsideration,
];

export interface AcademicStore {
  programs: Program[];
  exams: Exam[];
  credentials: Credential[];
  referees: Referee[];
  recommendations: Recommendation[];
  outreach: Outreach[];
  settings: OutreachSettings;
}

export function createAcademicStore(): AcademicStore {
  return {
    programs: [],
    exams: [],
    credentials: [],
    referees: [],
    recommendations: [],
    outreach: [],
    settings: {},
  };
}

export interface InMemoryAcademicOptions {
  clock: Clock;
  ids: IdGenerator;
  respond: <T>(value: T) => Promise<T>;
  fail: (code: ApiErrorCode, detail?: string) => Promise<never>;
  store?: AcademicStore;
  profileName: () => string;
  opportunity: (id: string) => OpportunityDetail | undefined;
}

export const ACADEMIC_REFERENCE: AcademicReference = {
  currency: 'USD',
  exams: Object.values(ExamKind).map((kind) => ({
    kind,
    sections: [],
    validityMonths: VALIDITY_MONTHS[kind],
  })),
  maxPerDay: LIMITS.maxPerDay,
  maxPerDepartment: LIMITS.maxPerDepartment,
  maxPerUniversity: LIMITS.maxPerUniversity,
  followUpsAllowed: false,
  checklistSteps: Object.values(ChecklistStep),
  maxTextLength: 4000,
};

function addMonths(day: string, months: number): string {
  const date = new Date(`${day}T00:00:00Z`);
  const target = date.getUTCMonth() + months;
  const result = new Date(
    Date.UTC(date.getUTCFullYear() + Math.floor(target / MONTHS_PER_YEAR), (((target % MONTHS_PER_YEAR) + MONTHS_PER_YEAR) % MONTHS_PER_YEAR) + 1, 0),
  );
  result.setUTCDate(Math.min(date.getUTCDate(), result.getUTCDate()));
  return result.toISOString().slice(0, DATE_LENGTH);
}

function shiftDays(day: string, days: number): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + days * MS_PER_DAY).toISOString().slice(0, DATE_LENGTH);
}

function sameText(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

export function createInMemoryAcademic(options: InMemoryAcademicOptions): AcademicApi {
  const { clock, ids, respond, fail } = options;
  const store = options.store ?? createAcademicStore();
  const today = () => clock.now().toISOString().slice(0, DATE_LENGTH);
  const invalid = (detail: string) => fail(ApiErrorCode.Validation, detail);
  const missing = () => fail(ApiErrorCode.NotFound);
  const find = async <T extends { id: string }>(items: T[], id: string): Promise<T> => items.find((item) => item.id === id) ?? missing();
  const withIds = <T extends { id: string }>(items: T[]): T[] => items.map((item) => (item.id ? item : { ...item, id: ids.next('aci') }));
  const expiry = (exam: Exam): string | undefined => {
    const base = exam.scoreReleaseOn ?? exam.testOn;
    return base && exam.status !== ExamStatus.Cancelled ? addMonths(base, exam.validityMonths ?? VALIDITY_MONTHS[exam.exam]) : undefined;
  };
  const viewExam = (exam: Exam): Exam => ({ ...exam, expiresOn: expiry(exam) });
  const consented = (id: string) => store.referees.find((r) => r.id === id)?.consentConfirmedOn !== undefined;
  const earliest = (program: Program) =>
    program.deadlines
      .filter((d) => EARLY_KINDS.includes(d.kind))
      .map((d) => d.on)
      .sort()[0];

  const warningsFor = (program: Program): AcademicWarning[] => {
    const deadline = earliest(program);
    const found: AcademicWarning[] = [];
    for (const requirement of program.examRequirements) {
      if (requirement.need === NeedLevel.NotRequired) {
        continue;
      }
      const expiries = store.exams
        .filter((e) => e.exam === requirement.exam && e.status === ExamStatus.ScoresReleased && e.scores)
        .map(expiry)
        .filter((d): d is string => d !== undefined)
        .sort();
      const latest = expiries[expiries.length - 1];
      if (!latest) {
        if (requirement.need === NeedLevel.Required) {
          found.push({
            kind: WarningKind.NoValidScore,
            programId: program.id,
            exam: requirement.exam,
          });
        }
      } else if (deadline && latest < deadline) {
        found.push({
          kind: WarningKind.ScoreExpiresBeforeDeadline,
          programId: program.id,
          exam: requirement.exam,
          on: latest,
        });
      } else if (program.startsOn && latest < program.startsOn) {
        found.push({
          kind: WarningKind.ScoreExpiresBeforeStart,
          programId: program.id,
          exam: requirement.exam,
          on: latest,
        });
      }
    }
    return found;
  };

  const blockersFor = (program: Program): PortalBlocker[] => {
    const portal = program.portal;
    const recs = store.recommendations.filter((r) => r.programId === program.id);
    const invited = new Set(portal.invites.filter((i) => i.invitedOn).map((i) => i.refereeId));
    const checks: Array<[boolean, PortalBlocker]> = [
      [portal.sections.some((s) => !s.done), PortalBlocker.SectionIncomplete],
      [portal.documents.some((d) => !d.uploaded), PortalBlocker.DocumentMissing],
      [recs.some((r) => !consented(r.refereeId)), PortalBlocker.RefereeNotConsented],
      [recs.some((r) => r.method === SubmissionMethod.PortalInvite && !invited.has(r.refereeId)), PortalBlocker.RefereeNotInvited],
      [portal.fee === PortalFee.Due, PortalBlocker.FeeDue],
      [portal.pendingItems.some((i) => !i.received), PortalBlocker.InstitutionItemPending],
      [program.credentialRequirements.some((c) => c.evidence === 'explicit' && c.status !== ItemProgress.Done), PortalBlocker.CredentialPending],
    ];
    return checks.filter(([hit]) => hit).map(([, blocker]) => blocker);
  };

  const planFor = (program: Program): Plan => {
    const deadline = earliest(program);
    const steps: PlanStep[] = [];
    if (deadline) {
      steps.push({
        kind: PlanStepKind.SendScores,
        on: shiftDays(deadline, -21),
        deadlineKind: DeadlineKind.Application,
        label: '',
      });
      steps.push({
        kind: PlanStepKind.PrepareDocuments,
        on: shiftDays(deadline, -30),
        deadlineKind: DeadlineKind.Application,
        label: '',
      });
      const referee = program.deadlines.find((d) => d.kind === DeadlineKind.Referee)?.on ?? deadline;
      steps.push({
        kind: PlanStepKind.RequestReferees,
        on: shiftDays(referee, -28),
        deadlineKind: DeadlineKind.Referee,
        label: '',
      });
    }
    for (const d of program.deadlines.filter((item) => EARLY_KINDS.includes(item.kind))) {
      steps.push({
        kind: PlanStepKind.SubmitApplication,
        on: shiftDays(d.on, -3),
        deadlineKind: d.kind,
        label: '',
      });
    }
    const totals = new Map<string, { official: number; estimate: number }>();
    const items = [...program.budget];
    if (program.fee.amount !== undefined && !items.some((i) => i.kind === 'application_fee')) {
      items.push({
        id: '',
        kind: 'application_fee',
        amount: program.fee.amount,
        currency: program.fee.currency || '-',
        source: program.fee.source,
        note: '',
      });
    }
    for (const item of items) {
      const sums = totals.get(item.currency) ?? { official: 0, estimate: 0 };
      sums[item.source === AmountSource.Official ? 'official' : 'estimate'] += item.amount;
      totals.set(item.currency, sums);
    }
    return {
      programId: program.id,
      steps: steps.sort((a, b) => a.on.localeCompare(b.on)),
      warnings: warningsFor(program),
      budget: [...totals.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([currency, sums]) => ({
          currency,
          ...sums,
          total: sums.official + sums.estimate,
        })),
      blockers: blockersFor(program),
    };
  };

  const cleanProgram = async (input: Parameters<AcademicApi['createProgram']>[0], existing?: Program) => {
    for (const invite of input.portal.invites) {
      if (!consented(invite.refereeId)) {
        return invalid(AcademicFailure.RefereeConsentRequired);
      }
    }
    if (input.linkedProgramIds.some((id) => !store.programs.some((p) => p.id === id) || id === existing?.id)) {
      return invalid(AcademicFailure.UnknownProgram);
    }
    const portal = {
      ...input.portal,
      invites: input.portal.invites.map((i) => ({
        ...i,
        authorizedOn: i.authorizedOn ?? today(),
      })),
      pendingItems: withIds(input.portal.pendingItems),
    };
    const decision = input.decision
      ? {
          ...input.decision,
          conditions: withIds(input.decision.conditions),
          actions: existing?.decision?.actions ?? [],
        }
      : undefined;
    return {
      ...input,
      portal,
      decision,
      budget: withIds(input.budget),
      checklist: withIds(input.checklist),
    };
  };

  const offerRows = (program: Program) => {
    const f = program.funding;
    const years = f.durationMonths ? f.durationMonths / MONTHS_PER_YEAR : undefined;
    const total =
      years && f.tuitionPerYear !== undefined && f.livingCostPerYear !== undefined ? (f.tuitionPerYear + f.livingCostPerYear) * years : undefined;
    const support = years && f.fundingPerYear !== undefined ? f.fundingPerYear * years : undefined;
    const net = total !== undefined && support !== undefined ? total - support : undefined;
    const value = (amount?: number) => ({
      ...(amount === undefined ? {} : { amount }),
      estimated: amount !== undefined,
    });
    return {
      programId: program.id,
      title: program.title,
      university: program.university,
      countryCode: program.countryCode,
      decision: program.decision?.kind ?? DecisionKind.Pending,
      ...((program.durationMonths ?? f.durationMonths) ? { durationMonths: program.durationMonths ?? f.durationMonths } : {}),
      totalCost: value(total),
      fundingTotal: value(support),
      netCost: value(net),
      currency: f.currency,
    };
  };

  const settingsRule = () => ({
    perDay: store.settings.maxPerDay ?? LIMITS.maxPerDay,
    perDepartment: store.settings.maxPerDepartment ?? LIMITS.maxPerDepartment,
    perUniversity: store.settings.maxPerUniversity ?? LIMITS.maxPerUniversity,
    followUps: store.settings.followUpsAllowed ?? false,
  });

  const markSent = async (outreach: Outreach, on: string): Promise<Outreach> => {
    const rule = settingsRule();
    const stopped = store.outreach.some(
      (o) => o.doNotContact && sameText(o.supervisorName, outreach.supervisorName) && sameText(o.university, outreach.university),
    );
    if (stopped || STOPPING.includes(outreach.status)) {
      return invalid(AcademicFailure.OutreachStopped);
    }
    const text = outreach.body.toLowerCase();
    if (!outreach.researchReference.trim() || !text.includes(outreach.researchReference.trim().toLowerCase())) {
      return invalid(AcademicFailure.OutreachGeneric);
    }
    const first = outreach.status === OutreachStatus.Draft;
    if (!first) {
      if (!(rule.followUps && outreach.allowFollowUp)) {
        return invalid(AcademicFailure.FollowUpNotAllowed);
      }
      if (outreach.lastSentOn && on < shiftDays(outreach.lastSentOn, LIMITS.followUpGapDays)) {
        return invalid(AcademicFailure.FollowUpTooSoon);
      }
    }
    if (store.outreach.filter((o) => o.id !== outreach.id && o.lastSentOn === on).length >= rule.perDay) {
      return invalid(AcademicFailure.OutreachLimit);
    }
    if (first) {
      const others = store.outreach.filter((o) => o.id !== outreach.id && o.sentOn && sameText(o.university, outreach.university));
      const department = others.filter((o) => outreach.department && sameText(o.department, outreach.department));
      if (others.length >= rule.perUniversity || department.length >= rule.perDepartment) {
        return invalid(AcademicFailure.OutreachLimit);
      }
    }
    return {
      ...outreach,
      status: OutreachStatus.Sent,
      sentOn: first ? on : outreach.sentOn,
      lastSentOn: on,
      followUpsSent: first ? outreach.followUpsSent : outreach.followUpsSent + 1,
    };
  };

  const replace = <T extends { id: string }>(items: T[], next: T): T => {
    const index = items.findIndex((item) => item.id === next.id);
    if (index >= 0) {
      items[index] = next;
    } else {
      items.push(next);
    }
    return next;
  };
  const drop = <T extends { id: string }>(items: T[], id: string): void => {
    const index = items.findIndex((item) => item.id === id);
    if (index >= 0) {
      items.splice(index, 1);
    }
  };

  return {
    reference: () => respond(ACADEMIC_REFERENCE),
    async overview() {
      const programs = store.programs;
      const warnings = programs.flatMap(warningsFor);
      const first = today();
      const last = shiftDays(first, 45);
      const upcoming = programs
        .flatMap((p) => p.deadlines.map((d) => ({ programId: p.id, kind: d.kind, on: d.on })))
        .filter((d) => d.on >= first && d.on <= last)
        .sort((a, b) => a.on.localeCompare(b.on));
      const attention = [
        ...store.outreach
          .filter((o) => NEEDS_ATTENTION.includes(o.status))
          .map((o) => ({
            kind: AttentionKind.OutreachReply,
            recordId: o.id,
            ...(o.programId ? { programId: o.programId } : {}),
          })),
        ...programs
          .filter((p) => p.portal.submission === PortalSubmission.InProgress && blockersFor(p).length)
          .map((p) => ({ kind: AttentionKind.PortalBlocked, programId: p.id })),
        ...warnings.map((w) => ({
          kind: AttentionKind.ScoreWarning,
          programId: w.programId,
          ...(w.on ? { on: w.on } : {}),
        })),
        ...upcoming.slice(0, programs.length).map((u) => ({
          kind: AttentionKind.DeadlineSoon,
          programId: u.programId,
          on: u.on,
        })),
      ];
      return respond({
        programs: programs.length,
        attention,
        upcoming,
        warnings,
      });
    },
    getSettings: () => respond({ ...store.settings }),
    async updateSettings(settings) {
      const over = [
        [settings.maxPerDay, LIMITS.maxPerDay],
        [settings.maxPerDepartment, LIMITS.maxPerDepartment],
        [settings.maxPerUniversity, LIMITS.maxPerUniversity],
      ].some(([value, max]) => value !== undefined && value > (max ?? 0));
      if (over) {
        return invalid(AcademicFailure.LimitAboveMaximum);
      }
      store.settings = { ...settings };
      return respond({ ...store.settings });
    },
    listPrograms: () => respond([...store.programs]),
    async getProgram(id) {
      return respond(await find(store.programs, id));
    },
    async createProgram(input) {
      const cleaned = await cleanProgram(input);
      return respond(replace(store.programs, { ...cleaned, id: ids.next('acp') }));
    },
    async createProgramFromOpportunity(opportunityId) {
      if (store.programs.some((p) => p.opportunityId === opportunityId)) {
        return fail(ApiErrorCode.Conflict, AcademicFailure.Duplicate);
      }
      const detail = options.opportunity(opportunityId);
      if (!detail) {
        return missing();
      }
      const kind = OPPORTUNITY_KINDS[detail.type];
      if (!kind) {
        return invalid(AcademicFailure.NotAStudyOpportunity);
      }
      const deadline = detail.deadline?.slice(0, DATE_LENGTH);
      const base = emptyProgramInput();
      return respond(
        replace(store.programs, {
          ...base,
          kind,
          title: detail.title,
          university: detail.organization,
          countryCode: detail.countryCode,
          sourceUrl: detail.source.url,
          opportunityId,
          deadlines: deadline
            ? [
                {
                  kind: DeadlineKind.Application,
                  on: deadline,
                  note: '',
                  sourceUrl: detail.source.url,
                },
              ]
            : [],
          id: ids.next('acp'),
        }),
      );
    },
    async updateProgram(id, input) {
      const existing = await find(store.programs, id);
      const cleaned = await cleanProgram(input, existing);
      return respond(replace(store.programs, { ...cleaned, id }));
    },
    async removeProgram(id) {
      await find(store.programs, id);
      drop(store.programs, id);
      store.recommendations = store.recommendations.filter((r) => r.programId !== id);
      return respond(undefined);
    },
    async plan(id) {
      return respond(planFor(await find(store.programs, id)));
    },
    async recordAction(id, action, confirmed) {
      if (!confirmed) {
        return invalid(AcademicFailure.ConfirmationRequired);
      }
      const program = await find(store.programs, id);
      if (!program.decision || !OFFERS.includes(program.decision.kind)) {
        return invalid(AcademicFailure.NotAnOffer);
      }
      const decision = {
        ...program.decision,
        actions: [...program.decision.actions, { action, confirmedOn: today() }],
      };
      return respond(replace(store.programs, { ...program, decision }));
    },
    async decisionMessage(id, action) {
      const program = await find(store.programs, id);
      const name = options.profileName();
      const verbs: Record<UserAction, string> = {
        [UserAction.AcceptOffer]: 'accept the offer for',
        [UserAction.PayDeposit]: 'confirm the deposit for',
        [UserAction.DeclineOffer]: 'decline the offer for',
      };
      return respond({
        subject: `${verbs[action]} ${program.title}`,
        body: `Dear Admissions Office,\n\nI would like to ${verbs[action]} ${program.title} at ${program.university}.\n\nSincerely,\n${name}`,
      });
    },
    async generateChecklist(id) {
      const program = await find(store.programs, id);
      if (!program.decision || !OFFERS.includes(program.decision.kind)) {
        return invalid(AcademicFailure.NotAnOffer);
      }
      const present = new Set(program.checklist.map((c) => c.step));
      const added = Object.values(ChecklistStep)
        .filter((step) => !present.has(step))
        .map((step) => ({
          id: ids.next('aci'),
          step,
          status: ItemProgress.Todo,
          ...(program.startsOn ? { dueOn: shiftDays(program.startsOn, -CHECKLIST_LEAD_DAYS[step]) } : {}),
          sourceUrl: '',
          note: '',
        }));
      return respond(
        replace(store.programs, {
          ...program,
          checklist: [...program.checklist, ...added],
        }),
      );
    },
    compareOffers(wanted) {
      const rows = store.programs
        .filter((p) => (!wanted?.length || wanted.includes(p.id)) && p.decision && OFFERS.includes(p.decision.kind))
        .map(offerRows);
      return respond(rows);
    },
    listExams: () => respond(store.exams.map(viewExam)),
    async createExam(input) {
      return respond(
        viewExam(
          replace(store.exams, {
            ...input,
            id: ids.next('acx'),
            reports: withIds(input.reports),
          }),
        ),
      );
    },
    async updateExam(id, input) {
      await find(store.exams, id);
      return respond(
        viewExam(
          replace(store.exams, {
            ...input,
            id,
            reports: withIds(input.reports),
          }),
        ),
      );
    },
    async removeExam(id) {
      await find(store.exams, id);
      drop(store.exams, id);
      return respond(undefined);
    },
    listCredentials: () => respond([...store.credentials]),
    async createCredential(input) {
      return respond(replace(store.credentials, credentialOf(input, ids.next('acc'))));
    },
    async updateCredential(id, input) {
      await find(store.credentials, id);
      return respond(replace(store.credentials, credentialOf(input, id)));
    },
    async removeCredential(id) {
      await find(store.credentials, id);
      drop(store.credentials, id);
      return respond(undefined);
    },
    listReferees: () => respond([...store.referees]),
    createReferee: (input) => respond(replace(store.referees, { ...input, id: ids.next('acr') })),
    async updateReferee(id, input) {
      const existing = await find(store.referees, id);
      return respond(
        replace(store.referees, {
          ...input,
          id,
          consentConfirmedOn: existing.consentConfirmedOn,
        }),
      );
    },
    async setRefereeConsent(id, confirmed) {
      const referee = await find(store.referees, id);
      const next: Referee = {
        ...referee,
        consentConfirmedOn: confirmed ? today() : undefined,
      };
      if (!confirmed) {
        store.recommendations = store.recommendations.map((r) => (r.refereeId === id ? { ...r, inviteAuthorized: false } : r));
      }
      return respond(replace(store.referees, next));
    },
    async removeReferee(id) {
      await find(store.referees, id);
      drop(store.referees, id);
      store.recommendations = store.recommendations.filter((r) => r.refereeId !== id);
      return respond(undefined);
    },
    listRecommendations: (programId) => respond(store.recommendations.filter((r) => !programId || r.programId === programId)),
    async createRecommendation(input) {
      await find(store.programs, input.programId);
      if (!consented(input.refereeId)) {
        return invalid(AcademicFailure.RefereeConsentRequired);
      }
      return respond(
        replace(store.recommendations, {
          ...input,
          id: ids.next('acm'),
          status: RecommendationStatus.Planned,
          evidenceNote: '',
        }),
      );
    },
    async updateRecommendation(id, input) {
      const existing = await find(store.recommendations, id);
      if (!consented(input.refereeId)) {
        return invalid(AcademicFailure.RefereeConsentRequired);
      }
      return respond(replace(store.recommendations, { ...existing, ...input, id }));
    },
    async setRecommendationStatus(id, change) {
      const existing = await find(store.recommendations, id);
      const proof = change.status === RecommendationStatus.Submitted || change.status === RecommendationStatus.Confirmed;
      if (proof) {
        const userOnly = change.evidence === ReceiptEvidence.UserStatement;
        const confirmedWrong = change.status === RecommendationStatus.Confirmed && change.evidence !== ReceiptEvidence.InstitutionConfirmation;
        if (!change.evidence || (userOnly && !change.evidenceNote?.trim()) || confirmedWrong) {
          return invalid(AcademicFailure.EvidenceRequired);
        }
      }
      const next: Recommendation = proof
        ? {
            ...existing,
            status: change.status,
            evidence: change.evidence,
            evidenceNote: change.evidenceNote?.trim() ?? '',
            evidenceOn: change.on ?? today(),
          }
        : {
            ...existing,
            status: change.status,
            evidence: undefined,
            evidenceNote: '',
            evidenceOn: undefined,
          };
      return respond(replace(store.recommendations, next));
    },
    async recommendationDraft(id, kind: DraftKind) {
      const recommendation = await find(store.recommendations, id);
      const referee = await find(store.referees, recommendation.refereeId);
      if (!referee.consentConfirmedOn) {
        return invalid(AcademicFailure.RefereeConsentRequired);
      }
      const program = await find(store.programs, recommendation.programId);
      const due = recommendation.refereeDeadline ?? 'no deadline stated';
      return respond({
        subject: `${kind === 'reminder' ? 'Reminder: recommendation letter' : 'Recommendation letter'} for ${program.title}`,
        body: `Dear ${referee.name},\n\nThe deadline for your letter for ${program.title} at ${program.university} is ${due}.\n\nSincerely,\n${options.profileName()}`,
      });
    },
    async removeRecommendation(id) {
      await find(store.recommendations, id);
      drop(store.recommendations, id);
      return respond(undefined);
    },
    listOutreach: () => respond([...store.outreach]),
    async draftOutreach(input) {
      const reference = input.researchReference.trim();
      if (reference.length < LIMITS.minReference) {
        return invalid(AcademicFailure.ResearchReferenceRequired);
      }
      const name = options.profileName();
      if (!name.trim()) {
        return invalid(AcademicFailure.ProfileNameRequired);
      }
      const known = store.outreach.filter((o) => sameText(o.supervisorName, input.supervisorName) && sameText(o.university, input.university));
      if (known.some((o) => o.doNotContact || STOPPING.includes(o.status))) {
        return invalid(AcademicFailure.OutreachStopped);
      }
      if (known.length) {
        return fail(ApiErrorCode.Conflict, AcademicFailure.Duplicate);
      }
      return respond(
        replace(store.outreach, {
          ...input,
          id: ids.next('aco'),
          subject: `Question about your research on ${reference}`,
          body: `Dear Professor ${input.supervisorName},\n\nI read your work on ${reference} and would like to ask whether you are taking on students for research at ${input.university}.\n\nSincerely,\n${name}`,
          allowFollowUp: false,
          status: OutreachStatus.Draft,
          draftedOn: today(),
          followUpsSent: 0,
          replyNote: '',
          doNotContact: false,
        }),
      );
    },
    async updateOutreach(id, input) {
      const existing = await find(store.outreach, id);
      return respond(replace(store.outreach, { ...existing, ...input, id }));
    },
    async markOutreachSent(id, on) {
      const outreach = await find(store.outreach, id);
      return respond(replace(store.outreach, await markSent(outreach, on ?? today())));
    },
    async recordOutreachReply(id, outcome, note) {
      const outreach = await find(store.outreach, id);
      if (outreach.status === OutreachStatus.Draft) {
        return invalid(AcademicFailure.NotSent);
      }
      const stop = outcome === ReplyOutcome.Declined || outcome === ReplyOutcome.DoNotContact;
      return respond(
        replace(store.outreach, {
          ...outreach,
          status: REPLY_STATUS[outcome],
          repliedOn: today(),
          replyNote: note?.trim() ?? '',
          doNotContact: stop || outreach.doNotContact,
        }),
      );
    },
    async removeOutreach(id) {
      await find(store.outreach, id);
      drop(store.outreach, id);
      return respond(undefined);
    },
  };
}

function credentialOf(input: Parameters<AcademicApi['createCredential']>[0], id: string): Credential {
  const source = input.convertedValue ? (input.conversionSource ?? 'estimate') : undefined;
  return {
    ...input,
    id,
    conversionSource: source,
    conversionIsEstimate: Boolean(input.convertedValue) && source !== 'official',
  };
}
