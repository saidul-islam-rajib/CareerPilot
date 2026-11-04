import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  AutomationLimits,
  AutomationOverview,
  AutomationRule,
  AutomationSettingsInput,
  RuleInput,
} from '@careerpilot/api-client';
import { DeadlineAction, SubmissionWindowKind, type DryRunOutcome, type SkipReason } from '@careerpilot/domain-ui-logic';
import { queryKeys } from '../query/query-keys';
import { useApi } from '../services/app-services';

const MAX_SCORE = 100;
const LIST_SEPARATOR = ',';
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export const RuleField = {
  Name: 'name',
  MinScore: 'minMatchScore',
  DailyCap: 'dailyCap',
  WeeklyCap: 'weeklyCap',
  TotalCap: 'totalCap',
  ExpiresOn: 'expiresOn',
  WindowStart: 'start',
  WindowEnd: 'end',
} as const;
export type RuleField = (typeof RuleField)[keyof typeof RuleField];

export const WizardStep = {
  Scope: 'scope',
  Filters: 'filters',
  Materials: 'materials',
  Limits: 'limits',
  Schedule: 'schedule',
  Review: 'review',
} as const;
export type WizardStep = (typeof WizardStep)[keyof typeof WizardStep];
export const WIZARD_STEPS: readonly WizardStep[] = Object.values(WizardStep);

export const skipReasonKey = (reason: SkipReason) => `automation.reason.${reason}`;
export const holdKey = (hold: string) => `automation.hold.${hold}`;
export const outcomeKey = (outcome: DryRunOutcome) => `automation.outcome.${outcome}`;
export const actionKey = (action: DeadlineAction) => `automation.action.${action}`;
export const userOnlyKey = (step: string) => `automation.userOnly.${step}`;
export const weekdayKey = (day: string) => `automation.weekday.${day}`;
export const routeKey = (route: string) => `automation.routeLabel.${route}`;
export const wizardStepKey = (step: WizardStep) => `automation.wizard.${step}`;

export function emptyRule(limits: AutomationLimits): RuleInput {
  return {
    name: '',
    enabled: true,
    trackIds: [],
    filters: {
      minMatchScore: limits.defaultMinMatchScore,
      allowedRoutes: [],
      countries: [],
      excludedEmployers: [],
      excludedKeywords: [],
      allowUnknownRequirements: false,
    },
    materials: {},
    limits: {},
    schedule: { kind: SubmissionWindowKind.AsSoonAsReady, days: [] },
  };
}

export function ruleToInput(rule: AutomationRule): RuleInput {
  return {
    name: rule.name,
    enabled: rule.enabled,
    trackIds: rule.trackIds,
    filters: rule.filters,
    materials: rule.materials,
    limits: rule.limits,
    schedule: rule.schedule,
  };
}

export function splitList(text: string): string[] {
  return text
    .split(LIST_SEPARATOR)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

export function joinList(items: readonly string[]): string {
  return items.join(`${LIST_SEPARATOR} `);
}

export function toggleValue<T>(items: readonly T[], value: T): T[] {
  return items.includes(value) ? items.filter((item) => item !== value) : [...items, value];
}

export function withValue<T extends object, K extends keyof T>(source: T, key: K, value: T[K] | undefined): T {
  const copy = { ...source };
  if (value === undefined) {
    delete copy[key];
  } else {
    copy[key] = value;
  }
  return copy;
}

export function parseCap(text: string): number | undefined {
  const value = Number.parseInt(text, 10);
  return Number.isFinite(value) ? value : undefined;
}

function capInvalid(value: number | undefined, max: number): boolean {
  return value !== undefined && (value < 1 || value > max);
}

export function validateRule(input: RuleInput, limits: AutomationLimits): RuleField[] {
  const failures: RuleField[] = [];
  const { filters, limits: caps, schedule } = input;
  if (input.name.trim().length === 0) failures.push(RuleField.Name);
  if (filters.minMatchScore < 0 || filters.minMatchScore > MAX_SCORE) failures.push(RuleField.MinScore);
  if (capInvalid(caps.dailyCap, limits.maxDailyCap)) failures.push(RuleField.DailyCap);
  if (capInvalid(caps.weeklyCap, limits.maxWeeklyCap)) failures.push(RuleField.WeeklyCap);
  if (capInvalid(caps.totalCap, limits.maxTotalCap)) failures.push(RuleField.TotalCap);
  if (caps.expiresOn !== undefined && !DATE_PATTERN.test(caps.expiresOn)) failures.push(RuleField.ExpiresOn);
  if (schedule.kind === SubmissionWindowKind.DailyWindow) {
    if (!TIME_PATTERN.test(schedule.start ?? '')) failures.push(RuleField.WindowStart);
    if (!TIME_PATTERN.test(schedule.end ?? '')) failures.push(RuleField.WindowEnd);
  }
  return failures;
}

export function validateSettings(input: AutomationSettingsInput, limits: AutomationLimits): boolean {
  const within = (value: number | undefined, low: number, high: number) => value === undefined || (value >= low && value <= high);
  return (
    within(input.deadlineBufferHours, 0, limits.maxDeadlineBufferHours) &&
    within(input.weeklyCap, 1, limits.maxWeeklyCap) &&
    within(input.inactivityDays, limits.minInactivityDays, limits.maxInactivityDays)
  );
}

export const DEADLINE_ACTIONS: readonly DeadlineAction[] = Object.values(DeadlineAction);

export function useAutomation() {
  const api = useApi();
  return useQuery({ queryKey: queryKeys.automation, queryFn: () => api.automation.overview() });
}

export function useSaveRule(ruleId?: string) {
  const api = useApi();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: RuleInput) => (ruleId ? api.automation.updateRule(ruleId, input) : api.automation.createRule(input)),
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.automation }),
  });
}

export function useDeleteRule() {
  const api = useApi();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.automation.deleteRule(id),
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.automation }),
  });
}

export function useReorderRules() {
  const api = useApi();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (ruleIds: string[]) => api.automation.reorderRules(ruleIds),
    onMutate: async (ruleIds) => {
      await client.cancelQueries({ queryKey: queryKeys.automation });
      const previous = client.getQueryData<AutomationOverview>(queryKeys.automation);
      if (previous) {
        const byId = new Map(previous.rules.map((rule) => [rule.id, rule]));
        const rules = ruleIds.flatMap((id) => byId.get(id) ?? []);
        client.setQueryData<AutomationOverview>(queryKeys.automation, { ...previous, rules });
      }
      return { previous };
    },
    onError: (_error, _ids, context) => {
      if (context?.previous) client.setQueryData(queryKeys.automation, context.previous);
    },
    onSettled: () => client.invalidateQueries({ queryKey: queryKeys.automation }),
  });
}

export function useAutomationSettings() {
  const api = useApi();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: AutomationSettingsInput) => api.automation.updateSettings(input),
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.automation }),
  });
}

export function useDryRun() {
  const api = useApi();
  return useMutation({ mutationFn: (ruleId?: string) => api.automation.dryRun(ruleId) });
}
