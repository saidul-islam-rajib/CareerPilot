import type { AutomationOverview, AutomationRule, AutomationSettings, AutomationSettingsInput, DryRunResult, RuleInput } from './types';

export interface AutomationApi {
  overview(): Promise<AutomationOverview>;
  createRule(input: RuleInput): Promise<AutomationRule>;
  updateRule(id: string, input: RuleInput): Promise<AutomationRule>;
  deleteRule(id: string): Promise<void>;
  reorderRules(ruleIds: string[]): Promise<AutomationRule[]>;
  updateSettings(input: AutomationSettingsInput): Promise<AutomationSettings>;
  dryRun(ruleId?: string): Promise<DryRunResult>;
}
