import type {
  FeeRuleInput,
  FeesOverview,
  FeesReference,
  PaymentActionInput,
  PaymentInput,
  PaymentView,
  ReceiptInput,
  RuleView,
} from './types';

export interface FeesApi {
  reference(): Promise<FeesReference>;
  overview(): Promise<FeesOverview>;
  listRules(): Promise<RuleView[]>;
  createRule(input: FeeRuleInput): Promise<RuleView>;
  updateRule(id: string, input: FeeRuleInput): Promise<RuleView>;
  removeRule(id: string): Promise<void>;
  paymentFromRule(ruleId: string): Promise<PaymentView>;
  listPayments(): Promise<PaymentView[]>;
  getPayment(id: string): Promise<PaymentView>;
  createPayment(input: PaymentInput): Promise<PaymentView>;
  updatePayment(id: string, input: PaymentInput): Promise<PaymentView>;
  removePayment(id: string): Promise<void>;
  recordAction(id: string, input: PaymentActionInput): Promise<PaymentView>;
  addReceipt(id: string, input: ReceiptInput): Promise<PaymentView>;
  removeReceipt(id: string, receiptId: string): Promise<PaymentView>;
}
