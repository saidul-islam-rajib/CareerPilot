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
