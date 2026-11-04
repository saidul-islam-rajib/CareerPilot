import type { FeeRuleInput, Payment, PaymentInput, RuleView } from '@careerpilot/api-client';
import { FeeKind, type PaymentMethod } from '@careerpilot/domain-ui-logic';
import { dateOfDeadline, deadlineFromDate } from './use-fees';

const AMOUNT_PATTERN = /^\d+$/;
export const NO_METHOD = '';

export interface FeeFormState {
  kind: FeeKind;
  title: string;
  organization: string;
  payee: string;
  payeeVerified: boolean;
  amount: string;
  currency: string;
  purpose: string;
  sourceUrl: string;
  deadline: string;
  waiverNote: string;
  note: string;
  method: string;
  transactionId: string;
}

export interface FeeFormErrors {
  title?: string;
  amount?: string;
  deadline?: string;
}

export function blankFeeForm(currency: string): FeeFormState {
  return {
    kind: FeeKind.Job,
    title: '',
    organization: '',
    payee: '',
    payeeVerified: false,
    amount: '',
    currency,
    purpose: '',
    sourceUrl: '',
    deadline: '',
    waiverNote: '',
    note: '',
    method: NO_METHOD,
    transactionId: '',
  };
}

export function withCurrency(state: FeeFormState, fallback?: string): FeeFormState {
  return state.currency ? state : { ...state, currency: fallback ?? '' };
}

export function feeFormErrors(state: FeeFormState): FeeFormErrors {
  return {
    title: state.title.trim() ? undefined : 'fees.form.titleRequired',
    amount: AMOUNT_PATTERN.test(state.amount.trim()) ? undefined : 'fees.form.amountRequired',
    deadline: deadlineFromDate(state.deadline) === null ? 'fees.form.deadlineInvalid' : undefined,
  };
}

export function feeFormHasErrors(errors: FeeFormErrors): boolean {
  return Object.values(errors).some(Boolean);
}

export function feeFormOfRule(view: RuleView): FeeFormState {
  const rule = view.rule;
  return {
    ...blankFeeForm(rule.currency),
    kind: rule.kind,
    title: rule.title,
    organization: rule.organization ?? '',
    payee: rule.payee ?? '',
    payeeVerified: rule.payeeVerified ?? false,
    amount: String(rule.amount),
    purpose: rule.purpose ?? '',
    sourceUrl: rule.sourceUrl ?? '',
    deadline: dateOfDeadline(rule.deadline),
    waiverNote: rule.waiverNote ?? '',
    note: rule.note ?? '',
  };
}

export function feeFormOfPayment(payment: Payment): FeeFormState {
  return {
    ...blankFeeForm(payment.currency),
    kind: payment.kind,
    title: payment.title,
    payee: payment.payee ?? '',
    payeeVerified: payment.payeeVerified ?? false,
    amount: String(payment.amount),
    purpose: payment.purpose ?? '',
    deadline: dateOfDeadline(payment.deadline),
    note: payment.note ?? '',
    method: payment.method ?? NO_METHOD,
    transactionId: payment.transactionId ?? '',
  };
}

export function feeRuleInput(state: FeeFormState): FeeRuleInput {
  return {
    kind: state.kind,
    title: state.title.trim(),
    organization: state.organization.trim(),
    payee: state.payee.trim(),
    payeeVerified: state.payeeVerified,
    amount: Number(state.amount),
    currency: state.currency,
    purpose: state.purpose.trim(),
    sourceUrl: state.sourceUrl.trim(),
    deadline: deadlineFromDate(state.deadline) ?? undefined,
    waiverNote: state.waiverNote.trim(),
    note: state.note.trim(),
  };
}

export function feePaymentInput(state: FeeFormState, existing?: Payment): PaymentInput {
  return {
    kind: state.kind,
    ruleId: existing?.ruleId,
    title: state.title.trim(),
    payee: state.payee.trim(),
    payeeVerified: state.payeeVerified,
    amount: Number(state.amount),
    currency: state.currency,
    purpose: state.purpose.trim(),
    method: state.method ? (state.method as PaymentMethod) : undefined,
    deadline: deadlineFromDate(state.deadline) ?? undefined,
    transactionId: state.transactionId.trim(),
    note: state.note.trim(),
  };
}
