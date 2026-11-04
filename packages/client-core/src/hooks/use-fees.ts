import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isApiError, type FeeRuleInput, type PaymentActionInput, type PaymentInput, type PaymentView, type ReceiptInput } from '@careerpilot/api-client';
import {
  FeeFailure,
  FeeUrgency,
  PaymentAction,
  PaymentStatus,
  StatusTone,
  type FeeGuidance,
  type FeeKind,
  type FeeReminderKind,
  type FeeWarning,
  type ReceiptKind,
} from '@careerpilot/domain-ui-logic';
import { usePublicConfig } from '../config/public-config';
import { useApi } from '../services/app-services';

export const feesKeys = {
  all: ['fees'] as const,
  reference: ['fees', 'reference'] as const,
  overview: ['fees', 'overview'] as const,
  rules: ['fees', 'rules'] as const,
  payments: ['fees', 'payments'] as const,
  payment: (id: string) => ['fees', 'payment', id] as const,
};

const ACTIONS_BY_STATUS: Record<PaymentStatus, PaymentAction[]> = {
  [PaymentStatus.Due]: [
    PaymentAction.ConfirmPaid,
    PaymentAction.MarkUncertain,
    PaymentAction.MarkFailed,
    PaymentAction.MarkWaived,
  ],
  [PaymentStatus.Uncertain]: [
    PaymentAction.ConfirmPaid,
    PaymentAction.ConfirmNotPaid,
    PaymentAction.MarkFailed,
    PaymentAction.MarkRefunded,
  ],
  [PaymentStatus.Failed]: [PaymentAction.ConfirmPaid, PaymentAction.MarkUncertain, PaymentAction.MarkRefunded],
  [PaymentStatus.Paid]: [PaymentAction.MarkRefunded],
  [PaymentStatus.Refunded]: [],
  [PaymentStatus.Waived]: [],
};
const OPEN_STATUSES: readonly PaymentStatus[] = [PaymentStatus.Due, PaymentStatus.Uncertain];
const NOTE_REQUIRED: readonly PaymentAction[] = [PaymentAction.MarkRefunded];
const EVIDENCE_ACTIONS: readonly PaymentAction[] = [PaymentAction.ConfirmPaid];

const STATUS_TONES: Record<PaymentStatus, StatusTone> = {
  [PaymentStatus.Due]: StatusTone.Info,
  [PaymentStatus.Paid]: StatusTone.Success,
  [PaymentStatus.Uncertain]: StatusTone.Warning,
  [PaymentStatus.Failed]: StatusTone.Danger,
  [PaymentStatus.Refunded]: StatusTone.Neutral,
  [PaymentStatus.Waived]: StatusTone.Neutral,
};
const KNOWN_FAILURES: readonly string[] = Object.values(FeeFailure);

export function feeStatusTone(status: PaymentStatus): StatusTone {
  return STATUS_TONES[status];
}

export function feeErrorKey(error: unknown): string {
  const detail = isApiError(error) ? error.detail : undefined;
  return detail && KNOWN_FAILURES.includes(detail) ? `fees.error.${detail}` : 'fees.error.generic';
}

export function feeStatusKey(status: PaymentStatus): string {
  return `fees.status.${status}`;
}

export function feeKindKey(kind: FeeKind): string {
  return `fees.kind.${kind}`;
}

export function feeActionKey(action: PaymentAction): string {
  return `fees.action.${action}`;
}

export function feeGuidanceKey(guidance: FeeGuidance): string {
  return `fees.guidance.${guidance}`;
}

export function feeWarningKey(warning: FeeWarning): string {
  return `fees.warning.${warning}`;
}

export function feeReminderKey(kind: FeeReminderKind): string {
  return `fees.reminder.${kind}`;
}

export function feeReceiptKey(kind: ReceiptKind): string {
  return `fees.receiptKind.${kind}`;
}

export function feeUrgencyKey(urgency: FeeUrgency): string | undefined {
  return urgency === FeeUrgency.None ? undefined : `fees.urgency.${urgency}`;
}

export function availableActions(status: PaymentStatus): PaymentAction[] {
  return ACTIONS_BY_STATUS[status];
}

export function actionNeedsNote(action: PaymentAction): boolean {
  return NOTE_REQUIRED.includes(action);
}

export function actionNeedsEvidence(action: PaymentAction, view: PaymentView): boolean {
  return EVIDENCE_ACTIONS.includes(action) && view.payment.receipts.length === 0 && !view.payment.transactionId;
}

export function isOpenStatus(status: PaymentStatus): boolean {
  return OPEN_STATUSES.includes(status);
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const END_OF_DAY = 'T23:59:00';
const DATE_LENGTH = 10;

export function deadlineFromDate(date: string): string | undefined | null {
  const text = date.trim();
  if (!text) {
    return undefined;
  }
  const moment = new Date(`${text}${END_OF_DAY}`);
  return DATE_PATTERN.test(text) && !Number.isNaN(moment.getTime()) ? moment.toISOString() : null;
}

export function dateOfDeadline(deadline?: string): string {
  if (!deadline) {
    return '';
  }
  const moment = new Date(deadline);
  const month = String(moment.getMonth() + 1).padStart(2, '0');
  const day = String(moment.getDate()).padStart(2, '0');
  return `${moment.getFullYear()}-${month}-${day}`.slice(0, DATE_LENGTH);
}

export function useFeeAmount() {
  const { config } = usePublicConfig();
  return useMemo(
    () => (amount: number | undefined, currency: string | undefined) => {
      if (amount === undefined) {
        return '';
      }
      const number = new Intl.NumberFormat(config.locale, { maximumFractionDigits: 0 }).format(amount);
      return currency ? `${currency} ${number}` : number;
    },
    [config.locale],
  );
}

export function useFeesReference() {
  const api = useApi();
  return useQuery({ queryKey: feesKeys.reference, queryFn: () => api.fees.reference() });
}

export function useFeesOverview() {
  const api = useApi();
  return useQuery({ queryKey: feesKeys.overview, queryFn: () => api.fees.overview() });
}

export function useFeeRules() {
  const api = useApi();
  return useQuery({ queryKey: feesKeys.rules, queryFn: () => api.fees.listRules() });
}

export function usePayments() {
  const api = useApi();
  return useQuery({ queryKey: feesKeys.payments, queryFn: () => api.fees.listPayments() });
}

export function usePayment(id: string) {
  const api = useApi();
  return useQuery({ queryKey: feesKeys.payment(id), queryFn: () => api.fees.getPayment(id) });
}

export function useFeeActions() {
  const api = useApi();
  const client = useQueryClient();
  const options = { onSuccess: () => client.invalidateQueries({ queryKey: feesKeys.all }) };
  return {
    createRule: useMutation({ mutationFn: (input: FeeRuleInput) => api.fees.createRule(input), ...options }),
    updateRule: useMutation({
      mutationFn: (input: { id: string; rule: FeeRuleInput }) => api.fees.updateRule(input.id, input.rule),
      ...options,
    }),
    removeRule: useMutation({ mutationFn: (id: string) => api.fees.removeRule(id), ...options }),
    paymentFromRule: useMutation({ mutationFn: (ruleId: string) => api.fees.paymentFromRule(ruleId), ...options }),
    createPayment: useMutation({ mutationFn: (input: PaymentInput) => api.fees.createPayment(input), ...options }),
    updatePayment: useMutation({
      mutationFn: (input: { id: string; payment: PaymentInput }) => api.fees.updatePayment(input.id, input.payment),
      ...options,
    }),
    removePayment: useMutation({ mutationFn: (id: string) => api.fees.removePayment(id), ...options }),
    record: useMutation({
      mutationFn: (input: { id: string; action: PaymentActionInput }) => api.fees.recordAction(input.id, input.action),
      ...options,
    }),
    addReceipt: useMutation({
      mutationFn: (input: { id: string; receipt: ReceiptInput }) => api.fees.addReceipt(input.id, input.receipt),
      ...options,
    }),
    removeReceipt: useMutation({
      mutationFn: (input: { id: string; receiptId: string }) => api.fees.removeReceipt(input.id, input.receiptId),
      ...options,
    }),
  };
}
