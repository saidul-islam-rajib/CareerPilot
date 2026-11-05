export const HostPolicy = { Allowed: 'allowed', Blocked: 'blocked', Review: 'review' } as const;
export type HostPolicy = (typeof HostPolicy)[keyof typeof HostPolicy];

export const WallKind = { None: 'none', SignIn: 'sign_in', Register: 'register' } as const;
export type WallKind = (typeof WallKind)[keyof typeof WallKind];

export const StopReason = {
  Captcha: 'captcha',
  Mfa: 'mfa',
  Identity: 'identity',
  Attestation: 'attestation',
  UnknownQuestion: 'unknown_question',
  NoExactChoice: 'no_exact_choice',
  Demographic: 'demographic',
  Assessment: 'assessment',
  Video: 'video',
  Payment: 'payment',
  Closed: 'closed',
  AlreadyApplied: 'already_applied',
  HostBlocked: 'host_blocked',
  HostReview: 'host_review',
  AutopilotOff: 'autopilot_off',
  LiveSwitchOff: 'live_switch_off',
  AccountCreationNotAllowed: 'account_creation_not_allowed',
  AccountExists: 'account_exists',
  LoginFailed: 'login_failed',
  AccountNeedsAttention: 'account_needs_attention',
  VerificationNeeded: 'verification_needed',
  SiteChanged: 'site_changed',
  NoForm: 'no_form',
  MissingCv: 'missing_cv',
  TermsNotAllowed: 'terms_not_allowed',
  UnsupportedUpload: 'unsupported_upload',
  PageLimit: 'page_limit',
  NavigationFailed: 'navigation_failed',
  WallUnverified: 'wall_unverified',
  CheckFailed: 'check_failed',
} as const;
export type StopReason = (typeof StopReason)[keyof typeof StopReason];

export const FieldSource = {
  ProfileFact: 'profile_fact',
  SavedAnswer: 'saved_answer',
  CoverLetter: 'cover_letter',
  Document: 'document',
  ConsentRule: 'consent_rule',
  Account: 'account',
} as const;
export type FieldSource = (typeof FieldSource)[keyof typeof FieldSource];

export const FieldStatus = {
  Mapped: 'mapped',
  Corrected: 'corrected',
  Skipped: 'skipped',
  Unknown: 'unknown',
  NoExactChoice: 'no_exact_choice',
  Demographic: 'demographic',
  Attestation: 'attestation',
  Unsupported: 'unsupported',
  TermsNotAllowed: 'terms_not_allowed',
} as const;
export type FieldStatus = (typeof FieldStatus)[keyof typeof FieldStatus];

export const Verdict = { CanAutoApply: 'can_auto_apply', WillStop: 'will_stop' } as const;
export type Verdict = (typeof Verdict)[keyof typeof Verdict];

export const AttemptState = {
  Stopped: 'stopped',
  Confirmed: 'confirmed',
  Uncertain: 'uncertain',
  Failed: 'failed',
  ReadinessOnly: 'readiness_only',
} as const;
export type AttemptState = (typeof AttemptState)[keyof typeof AttemptState];

export const PortalAccountStatus = { Active: 'active', NeedsAttention: 'needs_attention' } as const;
export type PortalAccountStatus = (typeof PortalAccountStatus)[keyof typeof PortalAccountStatus];

export const PortalAccountOrigin = { Created: 'created', Imported: 'imported' } as const;
export type PortalAccountOrigin = (typeof PortalAccountOrigin)[keyof typeof PortalAccountOrigin];

export const ReadinessState = { Pending: 'pending', Done: 'done', Failed: 'failed' } as const;
export type ReadinessState = (typeof ReadinessState)[keyof typeof ReadinessState];

export const PortalFailure = {
  UnknownHost: 'unknown_host',
  NotFound: 'portal_not_found',
  NotEnabled: 'autopilot_not_enabled',
  NotAcknowledged: 'summary_not_acknowledged',
  NotResumable: 'attempt_not_resumable',
  AlreadySubmitted: 'already_submitted',
  InvalidHost: 'invalid_host',
  InvalidUrl: 'invalid_url',
  DuplicateAccount: 'duplicate_account',
} as const;
export type PortalFailure = (typeof PortalFailure)[keyof typeof PortalFailure];
