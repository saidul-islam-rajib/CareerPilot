export const FeedbackVerdict = {
  GoodMatch: 'good_match',
  NotForMe: 'not_for_me',
} as const;
export type FeedbackVerdict = (typeof FeedbackVerdict)[keyof typeof FeedbackVerdict];

export const FeedbackReason = {
  WrongRole: 'wrong_role',
  WrongLocation: 'wrong_location',
  LowPay: 'low_pay',
  WrongLevel: 'wrong_level',
  WrongSkills: 'wrong_skills',
  WrongCompany: 'wrong_company',
  Other: 'other',
} as const;
export type FeedbackReason = (typeof FeedbackReason)[keyof typeof FeedbackReason];

export const BulkBlock = {
  HardFailure: 'hard_failure',
  UnansweredQuestions: 'unanswered_questions',
  Fee: 'fee',
  Attestation: 'attestation',
  Changed: 'changed',
  NotPending: 'not_pending',
  UnknownApproval: 'unknown_approval',
} as const;
export type BulkBlock = (typeof BulkBlock)[keyof typeof BulkBlock];

export const ReportKind = {
  DeadLink: 'dead_link',
  InaccurateDetail: 'inaccurate_detail',
  FalseMerge: 'false_merge',
  Fraud: 'fraud',
} as const;
export type ReportKind = (typeof ReportKind)[keyof typeof ReportKind];

export const ReportStatus = {
  Open: 'open',
  Reviewed: 'reviewed',
  Actioned: 'actioned',
  Dismissed: 'dismissed',
} as const;
export type ReportStatus = (typeof ReportStatus)[keyof typeof ReportStatus];
