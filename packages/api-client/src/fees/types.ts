import type {
  FeeGuidance,
  FeeKind,
  FeeLineSource,
  FeeReminderKind,
  FeeUrgency,
  FeeWarning,
  PaymentAction,
  PaymentMethod,
  PaymentStatus,
  ReceiptKind,
} from '@careerpilot/domain-ui-logic';

export interface FeesReference {
  defaultCurrency: string;
  currencies: string[];
  dueSoonDays: number;
  maxTextLength: number;
  maxReceiptsPerPayment: number;
}

export interface FeeRuleInput {
  kind: FeeKind;
  title: string;
  organization?: string;
  opportunityId?: string;
  applicationId?: string;
  payee?: string;
  payeeVerified?: boolean;
  amount: number;
  currency: string;
  purpose?: string;
  sourceUrl?: string;
  deadline?: string;
  waiverNote?: string;
  note?: string;
}

export interface FeeRuleRecord extends FeeRuleInput {
  id: string;
  userId: string;
  createdAt: string;
}

export interface RuleView {
  rule: FeeRuleRecord;
  urgency: FeeUrgency;
  paymentIds: string[];
}

export interface ReceiptInput {
  kind: ReceiptKind;
  reference: string;
  note?: string;
}

export interface Receipt extends ReceiptInput {
  id: string;
  addedAt: string;
}

export interface StatusEvent {
  status: PaymentStatus;
  at: string;
  note?: string;
}

export interface PaymentInput {
  kind?: FeeKind;
  ruleId?: string;
  title: string;
  payee?: string;
  payeeVerified?: boolean;
  amount: number;
  currency: string;
  purpose?: string;
  method?: PaymentMethod;
  deadline?: string;
  transactionId?: string;
  note?: string;
}

export interface Payment extends PaymentInput {
  id: string;
  userId: string;
  kind: FeeKind;
  status: PaymentStatus;
  paidAt?: string;
  receipts: Receipt[];
  history: StatusEvent[];
  createdAt: string;
}

export interface PaymentView {
  payment: Payment;
  urgency: FeeUrgency;
  warnings: FeeWarning[];
  guidance: FeeGuidance[];
}

export interface PaymentActionInput {
  action: PaymentAction;
  note?: string;
  transactionId?: string;
  paidAt?: string;
  receipt?: ReceiptInput;
}

export interface FeeLine {
  source: FeeLineSource;
  id: string;
  title: string;
  organization?: string;
  kind: FeeKind;
  amount?: number;
  currency?: string;
  status: PaymentStatus;
  deadline?: string;
  urgency: FeeUrgency;
  warnings: FeeWarning[];
  guidance: FeeGuidance[];
}

export interface FeeReminder {
  kind: FeeReminderKind;
  source: FeeLineSource;
  id: string;
  title: string;
  deadline?: string;
}

export interface FeeCurrencyTotal {
  currency: string;
  due: number;
  uncertain: number;
  paid: number;
}

export interface FeesOverview {
  lines: FeeLine[];
  reminders: FeeReminder[];
  totals: FeeCurrencyTotal[];
}
