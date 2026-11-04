import { describe, expect, it, vi } from 'vitest';
import {
  FeeFailure,
  FeeGuidance,
  FeeKind,
  FeeLineSource,
  FeeReminderKind,
  FeeUrgency,
  FeeWarning,
  PaymentAction,
  PaymentStatus,
  ReceiptKind,
} from '@careerpilot/domain-ui-logic';
import { ApiErrorCode } from '../errors';
import { sequentialIds } from '../ports';
import { createHttpClient } from '../http/http-client';
import { createHttpFees } from './http';
import { createInMemoryFees } from './in-memory';

const NOW = new Date('2026-10-20T06:00:00.000Z');
const DAY = 86_400_000;
const respond = <T>(value: T) => Promise.resolve(JSON.parse(JSON.stringify(value)) as T);
const fail = (code: ApiErrorCode, detail?: string) => Promise.reject(Object.assign(new Error(code), { code, detail }));
const RECEIPT = { kind: ReceiptKind.ReceiptNumber, reference: 'R-100' };

function setup() {
  return createInMemoryFees({ clock: { now: () => NOW }, ids: sequentialIds(), respond, fail, userId: () => 'usr_1' });
}

const payment = { title: 'Exam fee', amount: 700, currency: 'BDT', payee: 'Board' };
const rule = { kind: FeeKind.Job, title: 'Application fee', amount: 500, currency: 'BDT' };

describe('in-memory fees', () => {
  it('refuses to record a payment as paid without evidence', async () => {
    const api = setup();
    const created = await api.createPayment(payment);
    await expect(api.recordAction(created.payment.id, { action: PaymentAction.ConfirmPaid })).rejects.toMatchObject({
      detail: FeeFailure.EvidenceRequired,
    });
    const paid = await api.recordAction(created.payment.id, { action: PaymentAction.ConfirmPaid, receipt: RECEIPT });
    expect(paid.payment.status).toBe(PaymentStatus.Paid);
    expect(paid.payment.paidAt).toBeDefined();
  });

  it('keeps an uncertain payment open until the user confirms the outcome', async () => {
    const api = setup();
    const created = await api.createPayment(payment);
    const uncertain = await api.recordAction(created.payment.id, { action: PaymentAction.MarkUncertain });
    expect(uncertain.guidance).toEqual([FeeGuidance.VerifyWithPayee, FeeGuidance.DoNotPayAgain, FeeGuidance.AddReceipt]);
    const overview = await api.overview();
    expect(overview.reminders.map((reminder) => reminder.kind)).toEqual([FeeReminderKind.ConfirmOutcome]);
    const back = await api.recordAction(created.payment.id, { action: PaymentAction.ConfirmNotPaid });
    expect(back.payment.status).toBe(PaymentStatus.Due);
    await expect(api.recordAction(created.payment.id, { action: PaymentAction.ConfirmNotPaid })).rejects.toMatchObject({
      detail: FeeFailure.InvalidTransition,
    });
  });

  it('refuses a repeated transaction id and a refund without a note', async () => {
    const api = setup();
    const first = await api.createPayment({ ...payment, transactionId: 'TX-1' });
    await expect(api.createPayment({ ...payment, transactionId: 'tx-1' })).rejects.toMatchObject({
      code: ApiErrorCode.Conflict,
      detail: FeeFailure.DuplicateTransaction,
    });
    await api.recordAction(first.payment.id, { action: PaymentAction.ConfirmPaid });
    await expect(api.recordAction(first.payment.id, { action: PaymentAction.MarkRefunded })).rejects.toMatchObject({
      detail: FeeFailure.EvidenceRequired,
    });
  });

  it('flags a second paid payment for one fee as a possible duplicate', async () => {
    const api = setup();
    const fee = await api.createRule(rule);
    const first = await api.paymentFromRule(fee.rule.id);
    const second = await api.paymentFromRule(fee.rule.id);
    await api.recordAction(first.payment.id, { action: PaymentAction.ConfirmPaid, receipt: RECEIPT });
    const flagged = await api.recordAction(second.payment.id, { action: PaymentAction.ConfirmPaid, receipt: RECEIPT });
    expect(flagged.warnings).toContain(FeeWarning.PossibleDuplicate);
    expect(flagged.guidance).toEqual([FeeGuidance.CheckDuplicate, FeeGuidance.RequestRefund]);
  });

  it('builds the overview with reminders and totals per currency', async () => {
    const api = setup();
    await api.createRule({ ...rule, deadline: new Date(NOW.getTime() + DAY).toISOString() });
    const late = await api.createPayment({ ...payment, deadline: new Date(NOW.getTime() - DAY).toISOString() });
    await api.createPayment({ ...payment, currency: 'usd', amount: 20 });
    const overview = await api.overview();
    expect(late.urgency).toBe(FeeUrgency.Overdue);
    expect(overview.lines.map((line) => line.source)).toEqual([
      FeeLineSource.Payment,
      FeeLineSource.FeeRule,
      FeeLineSource.Payment,
    ]);
    expect(overview.reminders.map((reminder) => reminder.kind).sort()).toEqual([FeeReminderKind.DueSoon, FeeReminderKind.Overdue]);
    expect(overview.totals).toEqual([
      { currency: 'BDT', due: 1200, uncertain: 0, paid: 0 },
      { currency: 'USD', due: 20, uncertain: 0, paid: 0 },
    ]);
  });

  it('adds and removes receipts and rejects unsupported currencies', async () => {
    const api = setup();
    const created = await api.createPayment(payment);
    const added = await api.addReceipt(created.payment.id, RECEIPT);
    expect(added.payment.receipts).toHaveLength(1);
    const removed = await api.removeReceipt(created.payment.id, added.payment.receipts[0]!.id);
    expect(removed.payment.receipts).toEqual([]);
    await expect(api.createPayment({ ...payment, currency: 'XXX' })).rejects.toMatchObject({ detail: FeeFailure.UnsupportedCurrency });
  });

  it('removes rules and payments', async () => {
    const api = setup();
    const fee = await api.createRule(rule);
    const created = await api.createPayment(payment);
    await api.removeRule(fee.rule.id);
    await api.removePayment(created.payment.id);
    expect(await api.listRules()).toEqual([]);
    expect(await api.listPayments()).toEqual([]);
  });
});

describe('http fees', () => {
  it('calls the versioned paths', async () => {
    const fetchFn = vi.fn(async () => new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } }));
    const api = createHttpFees(
      createHttpClient({ baseUrl: 'https://api.example.com', timeoutMs: 1000, fetchFn: fetchFn as unknown as typeof fetch, getAccessToken: () => 't' }),
    );
    await api.overview();
    await api.recordAction('p 1', { action: PaymentAction.MarkUncertain });
    await api.removeReceipt('p1', 'r1');
    const calls = fetchFn.mock.calls.map((call) => call as unknown as [string, { method: string }]);
    expect(calls.map(([url, init]) => `${init.method} ${url}`)).toEqual([
      'GET https://api.example.com/v1/fees/overview',
      'POST https://api.example.com/v1/fees/payments/p%201/actions',
      'DELETE https://api.example.com/v1/fees/payments/p1/receipts/r1',
    ]);
  });
});
