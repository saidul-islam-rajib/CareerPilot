import type { CompensationRule } from '@careerpilot/api-client';
import { CompensationMode, PayPeriod, RangeBasis, UnstatedPolicy } from '@careerpilot/domain-ui-logic';

const AMOUNT_PATTERN = /^\d+(\.\d{1,2})?$/;
const MINOR_UNITS = 100;

export interface CompensationFormState {
  amount: string;
  currency: string;
  period: PayPeriod;
  mode: CompensationMode;
  unstated: UnstatedPolicy;
  basis: RangeBasis;
}

export const COMPENSATION_AMOUNT_INVALID = 'settings.pay.amountInvalid';

export function compensationFormOf(rule: CompensationRule | undefined, fallbackCurrency: string): CompensationFormState {
  return {
    amount: rule?.minimum ? String(rule.minimum.amountMinor / MINOR_UNITS) : '',
    currency: rule?.minimum?.currency ?? fallbackCurrency,
    period: rule?.period ?? PayPeriod.Monthly,
    mode: rule?.mode ?? CompensationMode.Preference,
    unstated: rule?.unstated ?? UnstatedPolicy.RecommendOnly,
    basis: rule?.basis ?? RangeBasis.Top,
  };
}

export function compensationFormError(form: CompensationFormState): string | undefined {
  const amount = form.amount.trim();
  return amount === '' || (AMOUNT_PATTERN.test(amount) && Number(amount) > 0) ? undefined : COMPENSATION_AMOUNT_INVALID;
}

export function compensationRuleOf(form: CompensationFormState): CompensationRule {
  const amount = form.amount.trim();
  return {
    minimum: amount === '' ? undefined : { amountMinor: Math.round(Number(amount) * MINOR_UNITS), currency: form.currency },
    period: form.period,
    mode: form.mode,
    unstated: form.unstated,
    basis: form.basis,
  };
}
