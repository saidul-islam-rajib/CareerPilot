export const FeeKind = {
  Job: 'job',
  Internship: 'internship',
  Government: 'government',
  Scholarship: 'scholarship',
  Admission: 'admission',
  Test: 'test',
  Other: 'other',
} as const;
export type FeeKind = (typeof FeeKind)[keyof typeof FeeKind];

export const PaymentStatus = {
  Due: 'due',
  Paid: 'paid',
  Uncertain: 'uncertain',
  Failed: 'failed',
  Refunded: 'refunded',
  Waived: 'waived',
} as const;
export type PaymentStatus = (typeof PaymentStatus)[keyof typeof PaymentStatus];

export const PaymentAction = {
  ConfirmPaid: 'confirm_paid',
  ConfirmNotPaid: 'confirm_not_paid',
  MarkUncertain: 'mark_uncertain',
  MarkFailed: 'mark_failed',
  MarkRefunded: 'mark_refunded',
  MarkWaived: 'mark_waived',
} as const;
export type PaymentAction = (typeof PaymentAction)[keyof typeof PaymentAction];

export const ReceiptKind = {
  ConfirmationMessage: 'confirmation_message',
  ReceiptNumber: 'receipt_number',
  PortalConfirmation: 'portal_confirmation',
  BankStatement: 'bank_statement',
} as const;
export type ReceiptKind = (typeof ReceiptKind)[keyof typeof ReceiptKind];

export const FeeLineSource = {
  FeeRule: 'fee_rule',
  Payment: 'payment',
  Government: 'government',
} as const;
export type FeeLineSource = (typeof FeeLineSource)[keyof typeof FeeLineSource];

export const FeeReminderKind = {
  DueSoon: 'due_soon',
  Overdue: 'overdue',
  ConfirmOutcome: 'confirm_outcome',
} as const;
export type FeeReminderKind = (typeof FeeReminderKind)[keyof typeof FeeReminderKind];

export const FeeGuidance = {
  VerifyWithPayee: 'verify_with_payee',
  DoNotPayAgain: 'do_not_pay_again',
  RequestRefund: 'request_refund',
  CheckDuplicate: 'check_duplicate',
  RetryAfterCheck: 'retry_after_check',
  AddReceipt: 'add_receipt',
} as const;
export type FeeGuidance = (typeof FeeGuidance)[keyof typeof FeeGuidance];

export const FeeWarning = {
  UnverifiedPayee: 'unverified_payee',
  AmountDiffers: 'amount_differs',
  PossibleDuplicate: 'possible_duplicate',
  NoReceipt: 'no_receipt',
} as const;
export type FeeWarning = (typeof FeeWarning)[keyof typeof FeeWarning];

export const FeeFailure = {
  TooManyItems: 'too_many_items',
  EvidenceRequired: 'evidence_required',
  DuplicateTransaction: 'duplicate_transaction',
  UnsupportedCurrency: 'unsupported_currency',
  InvalidTransition: 'invalid_transition',
  UnknownRule: 'unknown_rule',
} as const;
export type FeeFailure = (typeof FeeFailure)[keyof typeof FeeFailure];
