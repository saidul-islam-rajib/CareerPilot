import { describe, expect, it } from 'vitest';
import { catalogs, createTranslator } from '@careerpilot/i18n';
import { DeadlineAction, DryRunOutcome, SkipReason, SubmissionHold, SubmissionWindowKind, Weekday } from '@careerpilot/domain-ui-logic';
import {
  RuleField,
  actionKey,
  emptyRule,
  holdKey,
  joinList,
  outcomeKey,
  parseCap,
  skipReasonKey,
  splitList,
  toggleValue,
  validateRule,
  validateSettings,
  weekdayKey,
} from './use-automation';

const t = createTranslator(catalogs.en);
const limits = {
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

describe('automation helpers', () => {
  it('has catalog text for every reason, hold, outcome, action and weekday', () => {
    const keys = [
      ...Object.values(SkipReason).map(skipReasonKey),
      ...Object.values(SubmissionHold).map(holdKey),
      ...Object.values(DryRunOutcome).map(outcomeKey),
      ...Object.values(DeadlineAction).map(actionKey),
      ...Object.values(Weekday).map(weekdayKey),
    ];
    for (const key of keys) {
      expect(t(key)).not.toBe(key);
    }
  });

  it('starts a rule from the configured default score', () => {
    expect(emptyRule(limits).filters.minMatchScore).toBe(70);
  });

  it('validates names, caps, dates and windows', () => {
    const rule = emptyRule(limits);
    expect(validateRule(rule, limits)).toEqual([RuleField.Name]);
    const named = { ...rule, name: 'Mine' };
    expect(validateRule(named, limits)).toEqual([]);
    const bad = {
      ...named,
      limits: { dailyCap: 0, weeklyCap: 9999, expiresOn: 'soon' },
      schedule: { kind: SubmissionWindowKind.DailyWindow, start: '25:00', days: [] },
    };
    expect(validateRule(bad, limits)).toEqual([RuleField.DailyCap, RuleField.WeeklyCap, RuleField.ExpiresOn, RuleField.WindowStart, RuleField.WindowEnd]);
  });

  it('validates settings against the configured bounds', () => {
    expect(validateSettings({ inactivityDays: 3 }, limits)).toBe(false);
    expect(validateSettings({ inactivityDays: 14, weeklyCap: 10, deadlineBufferHours: 24 }, limits)).toBe(true);
  });

  it('splits, joins and toggles lists', () => {
    expect(splitList(' Acme , ,Kite ')).toEqual(['Acme', 'Kite']);
    expect(joinList(['Acme', 'Kite'])).toBe('Acme, Kite');
    expect(toggleValue(['a'], 'b')).toEqual(['a', 'b']);
    expect(toggleValue(['a', 'b'], 'a')).toEqual(['b']);
    expect(parseCap('12')).toBe(12);
    expect(parseCap('')).toBeUndefined();
  });
});
