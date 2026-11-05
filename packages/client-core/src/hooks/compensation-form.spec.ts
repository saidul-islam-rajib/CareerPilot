import { describe, expect, it } from 'vitest';
import { CompensationMode, PayPeriod } from '@careerpilot/domain-ui-logic';
import {
  COMPENSATION_AMOUNT_INVALID,
  compensationFormError,
  compensationFormOf,
  compensationRuleOf,
} from './compensation-form';

describe('compensation form', () => {
  it('starts as a preference with no minimum and turns the amount into minor units', () => {
    const blank = compensationFormOf(undefined, 'BDT');
    expect(blank.mode).toBe(CompensationMode.Preference);
    expect(compensationRuleOf(blank).minimum).toBeUndefined();
    const filled = compensationRuleOf({ ...blank, amount: '1250.50', period: PayPeriod.Yearly });
    expect(filled.minimum).toEqual({ amountMinor: 125_050, currency: 'BDT' });
  });

  it('accepts an empty amount and rejects anything that is not a positive number', () => {
    const blank = compensationFormOf(undefined, 'BDT');
    expect(compensationFormError(blank)).toBeUndefined();
    for (const amount of ['abc', '0', '-5', '1.234']) {
      expect(compensationFormError({ ...blank, amount })).toBe(COMPENSATION_AMOUNT_INVALID);
    }
  });
});
