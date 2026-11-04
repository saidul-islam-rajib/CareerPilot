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
} from '@careerpilot/domain-ui-logic';
import { ApiErrorCode } from '../errors';
import type { Clock, IdGenerator } from '../ports';
import type { FeesApi } from './ports';
import type { FeeCurrencyTotal, FeeLine, FeeReminder, FeeRuleRecord, FeesReference, Payment, PaymentView, RuleView } from './types';

const MS_PER_DAY = 86_400_000;
const MAX_RECEIPTS = 10;
const OPEN: readonly PaymentStatus[] = [PaymentStatus.Due, PaymentStatus.Uncertain];
const REFERENCE: FeesReference = {
  defaultCurrency: 'BDT',
  currencies: ['BDT', 'USD', 'GBP', 'EUR', 'CAD', 'AUD', 'AED', 'SAR', 'MYR', 'SGD', 'INR', 'JPY'],
  dueSoonDays: 3,
  maxTextLength: 1000,
  maxReceiptsPerPayment: MAX_RECEIPTS,
};
const ALLOWED_FROM: Record<PaymentAction, readonly PaymentStatus[]> = {
  [PaymentAction.ConfirmPaid]: [PaymentStatus.Due, PaymentStatus.Uncertain, PaymentStatus.Failed],
  [PaymentAction.ConfirmNotPaid]: [PaymentStatus.Uncertain],
  [PaymentAction.MarkUncertain]: [PaymentStatus.Due, PaymentStatus.Failed],
  [PaymentAction.MarkFailed]: [PaymentStatus.Due, PaymentStatus.Uncertain],
  [PaymentAction.MarkRefunded]: [PaymentStatus.Paid, PaymentStatus.Failed, PaymentStatus.Uncertain],
  [PaymentAction.MarkWaived]: [PaymentStatus.Due],
};
const RESULT: Record<PaymentAction, PaymentStatus> = {
  [PaymentAction.ConfirmPaid]: PaymentStatus.Paid,
  [PaymentAction.ConfirmNotPaid]: PaymentStatus.Due,
  [PaymentAction.MarkUncertain]: PaymentStatus.Uncertain,
  [PaymentAction.MarkFailed]: PaymentStatus.Failed,
  [PaymentAction.MarkRefunded]: PaymentStatus.Refunded,
  [PaymentAction.MarkWaived]: PaymentStatus.Waived,
};
const GUIDANCE: Partial<Record<PaymentStatus, FeeGuidance[]>> = {
  [PaymentStatus.Uncertain]: [FeeGuidance.VerifyWithPayee, FeeGuidance.DoNotPayAgain, FeeGuidance.AddReceipt],
  [PaymentStatus.Failed]: [FeeGuidance.VerifyWithPayee, FeeGuidance.RetryAfterCheck],
  [PaymentStatus.Refunded]: [FeeGuidance.AddReceipt],
};
const REMINDER_OF: Partial<Record<FeeUrgency, FeeReminderKind>> = {
  [FeeUrgency.DueSoon]: FeeReminderKind.DueSoon,
  [FeeUrgency.Overdue]: FeeReminderKind.Overdue,
};

export interface InMemoryFeesOptions {
  clock: Clock;
  ids: IdGenerator;
  respond: <T>(value: T) => Promise<T>;
  fail: (code: ApiErrorCode, detail?: string) => Promise<never>;
  userId: () => string;
}

function byDeadline(a: FeeLine, b: FeeLine): number {
  return (
    Number(!a.deadline) - Number(!b.deadline) || new Date(a.deadline ?? 0).getTime() - new Date(b.deadline ?? 0).getTime()
  );
}

export function createInMemoryFees(options: InMemoryFeesOptions): FeesApi {
  const { clock, ids, respond, fail } = options;
  const rules: FeeRuleRecord[] = [];
  const payments: Payment[] = [];
  const nowIso = () => clock.now().toISOString();

  const urgencyOf = (status: PaymentStatus, deadline?: string): FeeUrgency => {
    if (!OPEN.includes(status) || !deadline) {
      return FeeUrgency.None;
    }
    const at = new Date(deadline).getTime();
    const now = clock.now().getTime();
    if (at < now) {
      return FeeUrgency.Overdue;
    }
    return at <= now + REFERENCE.dueSoonDays * MS_PER_DAY ? FeeUrgency.DueSoon : FeeUrgency.Ok;
  };

  const duplicated = (payment: Payment) =>
    !!payment.ruleId &&
    payments.some((p) => p.id !== payment.id && p.ruleId === payment.ruleId && p.status === PaymentStatus.Paid);

  const warningsOf = (payment: Payment): FeeWarning[] => {
    const found: FeeWarning[] = [];
    if (OPEN.includes(payment.status) && !payment.payeeVerified) {
      found.push(FeeWarning.UnverifiedPayee);
    }
    const rule = rules.find((r) => r.id === payment.ruleId);
    if (rule && (rule.amount !== payment.amount || rule.currency !== payment.currency)) {
      found.push(FeeWarning.AmountDiffers);
    }
    if (payment.status === PaymentStatus.Paid) {
      if (payment.receipts.length === 0) {
        found.push(FeeWarning.NoReceipt);
      }
      if (duplicated(payment)) {
        found.push(FeeWarning.PossibleDuplicate);
      }
    }
    return found;
  };

  const guidanceOf = (payment: Payment, warnings: FeeWarning[]): FeeGuidance[] => {
    const steps = [...(GUIDANCE[payment.status] ?? [])];
    if (warnings.includes(FeeWarning.PossibleDuplicate)) {
      steps.push(FeeGuidance.CheckDuplicate, FeeGuidance.RequestRefund);
    }
    if (warnings.includes(FeeWarning.NoReceipt) && !steps.includes(FeeGuidance.AddReceipt)) {
      steps.push(FeeGuidance.AddReceipt);
    }
    return steps;
  };

  const viewOf = (payment: Payment): PaymentView => {
    const warnings = warningsOf(payment);
    return {
      payment: structuredClone(payment),
      urgency: urgencyOf(payment.status, payment.deadline),
      warnings,
      guidance: guidanceOf(payment, warnings),
    };
  };

  const ruleView = (rule: FeeRuleRecord): RuleView => {
    const linked = payments.filter((p) => p.ruleId === rule.id);
    const status = linked.some((p) => p.status === PaymentStatus.Paid) ? PaymentStatus.Paid : PaymentStatus.Due;
    return { rule: { ...rule }, urgency: urgencyOf(status, rule.deadline), paymentIds: linked.map((p) => p.id) };
  };

  const findPayment = async (id: string) => payments.find((p) => p.id === id) ?? fail(ApiErrorCode.NotFound);
  const findRule = async (id: string) => rules.find((r) => r.id === id) ?? fail(ApiErrorCode.NotFound);
  const checkMoney = async (currency: string) => {
    const code = currency.trim().toUpperCase();
    if (!REFERENCE.currencies.includes(code)) {
      await fail(ApiErrorCode.Validation, FeeFailure.UnsupportedCurrency);
    }
    return code;
  };
  const checkTransaction = async (transactionId: string | undefined, ownId?: string) => {
    const key = (transactionId ?? '').trim().toLowerCase();
    if (key && payments.some((p) => p.id !== ownId && (p.transactionId ?? '').trim().toLowerCase() === key)) {
      await fail(ApiErrorCode.Conflict, FeeFailure.DuplicateTransaction);
    }
    return (transactionId ?? '').trim();
  };

  const paymentLine = (payment: Payment): FeeLine => {
    const view = viewOf(payment);
    return {
      source: FeeLineSource.Payment,
      id: payment.id,
      title: payment.title,
      organization: payment.payee,
      kind: payment.kind,
      amount: payment.amount,
      currency: payment.currency,
      status: payment.status,
      deadline: payment.deadline,
      urgency: view.urgency,
      warnings: view.warnings,
      guidance: view.guidance,
    };
  };

  const ruleLine = (rule: FeeRuleRecord): FeeLine => ({
    source: FeeLineSource.FeeRule,
    id: rule.id,
    title: rule.title,
    organization: rule.organization || rule.payee,
    kind: rule.kind,
    amount: rule.amount,
    currency: rule.currency,
    status: PaymentStatus.Due,
    deadline: rule.deadline,
    urgency: urgencyOf(PaymentStatus.Due, rule.deadline),
    warnings: [],
    guidance: [],
  });

  const lines = (): FeeLine[] => {
    const linkedRules = new Set(payments.map((p) => p.ruleId).filter(Boolean));
    const unpaid = rules.filter((r) => !linkedRules.has(r.id)).map(ruleLine);
    return [...payments.map(paymentLine), ...unpaid].sort(byDeadline);
  };

  const remindersOf = (all: FeeLine[]): FeeReminder[] =>
    all.flatMap((line) => {
      const kind = line.status === PaymentStatus.Uncertain ? FeeReminderKind.ConfirmOutcome : REMINDER_OF[line.urgency];
      return kind ? [{ kind, source: line.source, id: line.id, title: line.title, deadline: line.deadline }] : [];
    });

  const totalsOf = (all: FeeLine[]): FeeCurrencyTotal[] => {
    const byCurrency = new Map<string, FeeCurrencyTotal>();
    for (const line of all) {
      if (line.amount === undefined || !line.currency) {
        continue;
      }
      const total = byCurrency.get(line.currency) ?? { currency: line.currency, due: 0, uncertain: 0, paid: 0 };
      if (line.status === PaymentStatus.Due) {
        total.due += line.amount;
      } else if (line.status === PaymentStatus.Uncertain) {
        total.uncertain += line.amount;
      } else if (line.status === PaymentStatus.Paid) {
        total.paid += line.amount;
      }
      byCurrency.set(line.currency, total);
    }
    return [...byCurrency.values()].sort((a, b) => a.currency.localeCompare(b.currency));
  };

  const newPayment = (fields: Partial<Payment> & Pick<Payment, 'title' | 'amount' | 'currency'>): Payment => ({
    kind: FeeKind.Other,
    ...fields,
    id: ids.next('fep'),
    userId: options.userId(),
    status: PaymentStatus.Due,
    receipts: [],
    history: [{ status: PaymentStatus.Due, at: nowIso() }],
    createdAt: nowIso(),
  });

  return {
    reference: () => respond({ ...REFERENCE }),
    overview: () => {
      const all = lines();
      return respond({ lines: all, reminders: remindersOf(all), totals: totalsOf(all) });
    },
    listRules: () => respond(rules.map(ruleView)),
    async createRule(input) {
      const currency = await checkMoney(input.currency);
      const rule: FeeRuleRecord = { ...input, currency, id: ids.next('fer'), userId: options.userId(), createdAt: nowIso() };
      rules.push(rule);
      return respond(ruleView(rule));
    },
    async updateRule(id, input) {
      const existing = await findRule(id);
      const currency = await checkMoney(input.currency);
      Object.assign(existing, input, { currency });
      return respond(ruleView(existing));
    },
    async removeRule(id) {
      await findRule(id);
      rules.splice(
        rules.findIndex((r) => r.id === id),
        1,
      );
      await respond(true);
    },
    async paymentFromRule(ruleId) {
      const rule = await findRule(ruleId);
      const payment = newPayment({
        kind: rule.kind,
        ruleId: rule.id,
        title: rule.title,
        payee: rule.payee,
        payeeVerified: rule.payeeVerified,
        amount: rule.amount,
        currency: rule.currency,
        purpose: rule.purpose,
        deadline: rule.deadline,
      });
      payments.push(payment);
      return respond(viewOf(payment));
    },
    listPayments: () => respond(payments.map(viewOf)),
    async getPayment(id) {
      return respond(viewOf(await findPayment(id)));
    },
    async createPayment(input) {
      const currency = await checkMoney(input.currency);
      if (input.ruleId) {
        await findRule(input.ruleId);
      }
      const transactionId = await checkTransaction(input.transactionId);
      const payment = newPayment({ ...input, currency, transactionId });
      payments.push(payment);
      return respond(viewOf(payment));
    },
    async updatePayment(id, input) {
      const existing = await findPayment(id);
      const currency = await checkMoney(input.currency);
      const transactionId = await checkTransaction(input.transactionId, id);
      Object.assign(existing, input, { currency, transactionId, kind: input.kind ?? existing.kind });
      return respond(viewOf(existing));
    },
    async removePayment(id) {
      await findPayment(id);
      payments.splice(
        payments.findIndex((p) => p.id === id),
        1,
      );
      await respond(true);
    },
    async recordAction(id, input) {
      const payment = await findPayment(id);
      if (!ALLOWED_FROM[input.action].includes(payment.status)) {
        await fail(ApiErrorCode.Validation, FeeFailure.InvalidTransition);
      }
      if (input.action === PaymentAction.MarkRefunded && !input.note?.trim()) {
        await fail(ApiErrorCode.Validation, FeeFailure.EvidenceRequired);
      }
      if (input.transactionId !== undefined) {
        payment.transactionId = await checkTransaction(input.transactionId, id);
      }
      if (input.receipt) {
        payment.receipts.push({ ...input.receipt, id: ids.next('fec'), addedAt: nowIso() });
      }
      if (input.action === PaymentAction.ConfirmPaid) {
        if (payment.receipts.length === 0 && !payment.transactionId) {
          await fail(ApiErrorCode.Validation, FeeFailure.EvidenceRequired);
        }
        payment.paidAt = input.paidAt ?? nowIso();
      }
      payment.status = RESULT[input.action];
      payment.history.push({ status: payment.status, at: nowIso(), note: input.note?.trim() ?? '' });
      return respond(viewOf(payment));
    },
    async addReceipt(id, input) {
      const payment = await findPayment(id);
      if (payment.receipts.length >= MAX_RECEIPTS) {
        await fail(ApiErrorCode.Validation, FeeFailure.TooManyItems);
      }
      payment.receipts.push({ ...input, id: ids.next('fec'), addedAt: nowIso() });
      return respond(viewOf(payment));
    },
    async removeReceipt(id, receiptId) {
      const payment = await findPayment(id);
      payment.receipts = payment.receipts.filter((r) => r.id !== receiptId);
      return respond(viewOf(payment));
    },
  };
}
