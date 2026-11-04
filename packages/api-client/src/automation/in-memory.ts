import { DeadlineAction, DryRunOutcome, SkipReason, type ApplicationRoute } from '@careerpilot/domain-ui-logic';
import { ApiErrorCode } from '../errors';
import type { Clock, IdGenerator } from '../ports';
import type { AutomationApi } from './ports';
import type {
  AutomationLimits,
  AutomationOverview,
  AutomationRule,
  AutomationSettings,
  AutomationSettingsInput,
  DryRunItem,
  DryRunResult,
  RuleInput,
} from './types';

const DEFAULT_LIMITS: AutomationLimits = {
  maxRules: 10,
  defaultMinMatchScore: 70,
  maxDailyCap: 50,
  maxWeeklyCap: 200,
  maxTotalCap: 1000,
  minInactivityDays: 7,
  maxInactivityDays: 365,
  maxDeadlineBufferHours: 336,
  maxListItems: 50,
};
const DEFAULT_SETTINGS: AutomationSettings = {
  deadlineBufferHours: 24,
  deadlineAction: DeadlineAction.NotifyAndAsk,
  weeklyCap: 35,
  inactivityDays: 30,
  dailyCap: 20,
};
const USER_ONLY_STEPS = [
  'captcha_or_human_check',
  'assessments_and_tests',
  'interviews_and_video',
  'legal_declarations',
  'payments_outside_rule',
  'offer_decisions',
  'sources_prohibiting_automation',
];
const MAX_SCORE = 100;

export interface AutomationCandidate {
  id: string;
  title: string;
  organization: string;
  trackId: string;
  matchScore: number;
  route: ApplicationRoute;
  countryCode: string;
}

export interface InMemoryAutomationOptions {
  clock: Clock;
  ids: IdGenerator;
  respond: <T>(value: T) => Promise<T>;
  fail: (code: ApiErrorCode) => Promise<never>;
  candidates: () => AutomationCandidate[];
  limits?: AutomationLimits;
}

export function createInMemoryAutomation(options: InMemoryAutomationOptions): AutomationApi {
  const { clock, ids, respond, fail } = options;
  const limits = options.limits ?? DEFAULT_LIMITS;
  let rules: AutomationRule[] = [];
  let settings: AutomationSettings = { ...DEFAULT_SETTINGS };
  const valid = (input: RuleInput) =>
    input.name.trim().length > 0 && input.filters.minMatchScore >= 0 && input.filters.minMatchScore <= MAX_SCORE;
  const ordered = () => [...rules].sort((a, b) => a.position - b.position);
  const find = (id: string) => rules.find((r) => r.id === id);
  const judge = (candidate: AutomationCandidate, rule: AutomationRule | undefined): DryRunItem => {
    const reasons: SkipReason[] = [];
    if (rule && candidate.matchScore < rule.filters.minMatchScore) reasons.push(SkipReason.BelowScore);
    if (rule && rule.filters.countries.length > 0 && !rule.filters.countries.includes(candidate.countryCode)) {
      reasons.push(SkipReason.CountryNotAllowed);
    }
    const base: DryRunItem = {
      opportunityId: candidate.id,
      title: candidate.title,
      organization: candidate.organization,
      trackId: candidate.trackId,
      matchScore: candidate.matchScore,
      outcome: reasons.length > 0 ? DryRunOutcome.Skipped : DryRunOutcome.WouldApply,
      reasons,
      route: candidate.route,
      bypassesWindow: false,
      ...(rule ? { ruleId: rule.id, ruleName: rule.name } : {}),
    };
    return reasons.length > 0
      ? base
      : { ...base, materials: { cvName: 'CV', cvVersion: 1, coverLetter: `Dear ${candidate.organization} hiring team`, answers: [] } };
  };
  return {
    overview: () => {
      const overview: AutomationOverview = {
        rules: ordered(),
        settings,
        holds: [],
        submittedToday: 0,
        submittedThisWeek: 0,
        skipped: [],
        userOnlySteps: USER_ONLY_STEPS,
        limits,
      };
      return respond(overview);
    },
    createRule: (input) => {
      if (!valid(input) || rules.length >= limits.maxRules) return fail(ApiErrorCode.Validation);
      const now = clock.now().toISOString();
      const rule: AutomationRule = { ...input, id: ids.next('rul'), position: rules.length, createdAt: now, updatedAt: now };
      rules = [...rules, rule];
      return respond(rule);
    },
    updateRule: (id, input) => {
      const current = find(id);
      if (!current) return fail(ApiErrorCode.NotFound);
      if (!valid(input)) return fail(ApiErrorCode.Validation);
      const updated: AutomationRule = {
        ...input,
        id,
        position: current.position,
        createdAt: current.createdAt,
        updatedAt: clock.now().toISOString(),
      };
      rules = rules.map((r) => (r.id === id ? updated : r));
      return respond(updated);
    },
    deleteRule: (id) => {
      if (!find(id)) return fail(ApiErrorCode.NotFound);
      rules = ordered()
        .filter((r) => r.id !== id)
        .map((r, position) => ({ ...r, position }));
      return respond(undefined);
    },
    reorderRules: (ruleIds) => {
      if (ruleIds.length !== rules.length || ruleIds.some((id) => !find(id))) return fail(ApiErrorCode.Validation);
      rules = rules.map((r) => ({ ...r, position: ruleIds.indexOf(r.id) }));
      return respond(ordered());
    },
    updateSettings: (input: AutomationSettingsInput) => {
      settings = {
        ...settings,
        deadlineBufferHours: input.deadlineBufferHours ?? settings.deadlineBufferHours,
        deadlineAction: input.deadlineAction ?? settings.deadlineAction,
        weeklyCap: input.weeklyCap ?? settings.weeklyCap,
        inactivityDays: input.inactivityDays ?? settings.inactivityDays,
      };
      return respond(settings);
    },
    dryRun: (ruleId) => {
      const rule = ruleId ? find(ruleId) : undefined;
      if (ruleId && !rule) return fail(ApiErrorCode.NotFound);
      const items = options.candidates().map((candidate) => judge(candidate, rule));
      const count = (outcome: DryRunOutcome) => items.filter((i) => i.outcome === outcome).length;
      const result: DryRunResult = {
        ranAt: clock.now().toISOString(),
        ...(ruleId ? { ruleId } : {}),
        holds: [],
        items,
        wouldApply: count(DryRunOutcome.WouldApply),
        deferred: count(DryRunOutcome.Deferred),
        skipped: count(DryRunOutcome.Skipped),
        submitted: 0,
      };
      return respond(result);
    },
  };
}
