import type { ApplicationRoute, DeadlineAction, DryRunOutcome, SkipReason, SkipStage, SubmissionWindowKind, Weekday } from '@careerpilot/domain-ui-logic';

export interface RuleFilters {
  minMatchScore: number;
  allowedRoutes: ApplicationRoute[];
  countries: string[];
  excludedEmployers: string[];
  excludedKeywords: string[];
  allowUnknownRequirements: boolean;
}

export interface RuleMaterials {
  cvDocumentId?: string;
}

export interface RuleLimits {
  dailyCap?: number;
  weeklyCap?: number;
  totalCap?: number;
  expiresOn?: string;
}

export interface RuleSchedule {
  kind: SubmissionWindowKind;
  start?: string;
  end?: string;
  days: Weekday[];
}

export interface RuleInput {
  name: string;
  enabled: boolean;
  trackIds: string[];
  filters: RuleFilters;
  materials: RuleMaterials;
  limits: RuleLimits;
  schedule: RuleSchedule;
}

export interface AutomationRule extends RuleInput {
  id: string;
  position: number;
  createdAt: string;
  updatedAt: string;
}

export interface AutomationSettingsInput {
  deadlineBufferHours?: number;
  deadlineAction?: DeadlineAction;
  weeklyCap?: number;
  inactivityDays?: number;
}

export interface AutomationSettings {
  deadlineBufferHours: number;
  deadlineAction: DeadlineAction;
  weeklyCap: number;
  inactivityDays: number;
  dailyCap: number;
}

export interface AutomationLimits {
  maxRules: number;
  defaultMinMatchScore: number;
  maxDailyCap: number;
  maxWeeklyCap: number;
  maxTotalCap: number;
  minInactivityDays: number;
  maxInactivityDays: number;
  maxDeadlineBufferHours: number;
  maxListItems: number;
}

export interface SkippedRecord {
  opportunityId: string;
  title: string;
  organization: string;
  stage: SkipStage;
  reasons: SkipReason[];
  ruleId?: string;
  at: string;
}

export interface AutomationOverview {
  rules: AutomationRule[];
  settings: AutomationSettings;
  holds: SkipReason[];
  submittedToday: number;
  submittedThisWeek: number;
  skipped: SkippedRecord[];
  userOnlySteps: string[];
  limits: AutomationLimits;
}

export interface DryRunMaterials {
  cvName: string;
  cvVersion: number;
  coverLetter: string;
  answers: string[];
}

export interface DryRunItem {
  opportunityId: string;
  title: string;
  organization: string;
  trackId: string;
  matchScore: number;
  outcome: DryRunOutcome;
  reasons: SkipReason[];
  ruleId?: string;
  ruleName?: string;
  route: ApplicationRoute;
  materials?: DryRunMaterials;
  earliestAt?: string;
  bypassesWindow: boolean;
}

export interface DryRunResult {
  ranAt: string;
  ruleId?: string;
  holds: SkipReason[];
  items: DryRunItem[];
  wouldApply: number;
  deferred: number;
  skipped: number;
  submitted: number;
}

