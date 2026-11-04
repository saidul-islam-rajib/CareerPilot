import { describe, expect, it } from 'vitest';
import { catalogs, createTranslator } from '@careerpilot/i18n';
import { DayKind, Eligibility, EligibilityReason, FeeUrgency } from '@careerpilot/domain-ui-logic';
import { dayNoteKey, eligibilityKey, enumLabelKey, moveItem, reasonKey, urgencyKey } from './use-government';

const t = createTranslator(catalogs.en);

describe('government helpers', () => {
  it('moves an item to a new place and ignores impossible moves', () => {
    expect(moveItem(['a', 'b', 'c'], 0, 2)).toEqual(['b', 'c', 'a']);
    expect(moveItem(['a', 'b'], 5, 0)).toEqual(['a', 'b']);
  });

  it('has catalog text for every eligibility, reason, day kind and urgency', () => {
    for (const outcome of Object.values(Eligibility)) {
      expect(t(eligibilityKey(outcome))).not.toBe(eligibilityKey(outcome));
    }
    for (const reason of Object.values(EligibilityReason)) {
      expect(t(reasonKey(reason))).not.toBe(reasonKey(reason));
    }
    expect(dayNoteKey(DayKind.Working)).toBeUndefined();
    expect(t(dayNoteKey(DayKind.Weekend) ?? '')).toContain('weekend');
    expect(urgencyKey(FeeUrgency.None)).toBeUndefined();
    expect(t(urgencyKey(FeeUrgency.Overdue) ?? '')).toBe('Payment overdue');
    expect(t(enumLabelKey('gov_stage', 'viva'))).toBe('Viva');
  });
});
