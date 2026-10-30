export const SubmissionStatus = {
  NotStarted: 'not_started',
  Preparing: 'preparing',
  AwaitingUserInformation: 'awaiting_user_information',
  AwaitingApproval: 'awaiting_approval',
  ApprovedQueued: 'approved_queued',
  Submitting: 'submitting',
  SubmittedAwaitingConfirmation: 'submitted_awaiting_confirmation',
  Confirmed: 'confirmed',
  Failed: 'failed',
  ManualActionRequired: 'manual_action_required',
  OutcomeUnknown: 'outcome_unknown',
  Cancelled: 'cancelled',
} as const;
export type SubmissionStatus = (typeof SubmissionStatus)[keyof typeof SubmissionStatus];

export const OutcomeStatus = {
  NoResponseYet: 'no_response_yet',
  UnderReview: 'under_review',
  Assessment: 'assessment',
  Interview: 'interview',
  OfferReceived: 'offer_received',
  Admitted: 'admitted',
  ConditionallyAdmitted: 'conditionally_admitted',
  Waitlisted: 'waitlisted',
  Deferred: 'deferred',
  Rejected: 'rejected',
  OfferAccepted: 'offer_accepted',
  OfferDeclined: 'offer_declined',
  Withdrawn: 'withdrawn',
  Closed: 'closed',
} as const;
export type OutcomeStatus = (typeof OutcomeStatus)[keyof typeof OutcomeStatus];

export const OpportunityDecision = {
  Interested: 'interested',
  Saved: 'saved',
  Dismissed: 'dismissed',
  NotEligible: 'not_eligible',
  Irrelevant: 'irrelevant',
} as const;
export type OpportunityDecision = (typeof OpportunityDecision)[keyof typeof OpportunityDecision];

export const TrackKind = {
  Remote: 'remote',
  InternationalSponsored: 'international_sponsored',
  BangladeshOnsite: 'bangladesh_onsite',
  BangladeshGovernment: 'bangladesh_government',
  Custom: 'custom',
} as const;
export type TrackKind = (typeof TrackKind)[keyof typeof TrackKind];

export const ApplicationMode = {
  Off: 'off',
  ApproveEach: 'approve_each',
  Automatic: 'automatic',
} as const;
export type ApplicationMode = (typeof ApplicationMode)[keyof typeof ApplicationMode];

export const ApplicationRoute = {
  Email: 'email',
  AtsPortal: 'ats_portal',
  EmployerPortal: 'employer_portal',
  GovernmentPortal: 'government_portal',
  GuidedManual: 'guided_manual',
} as const;
export type ApplicationRoute = (typeof ApplicationRoute)[keyof typeof ApplicationRoute];

export const OpportunityType = {
  Job: 'job',
  GovernmentJob: 'government_job',
  Masters: 'masters',
  Phd: 'phd',
  Scholarship: 'scholarship',
  Internship: 'internship',
} as const;
export type OpportunityType = (typeof OpportunityType)[keyof typeof OpportunityType];

export const WorkArrangement = {
  Remote: 'remote',
  Hybrid: 'hybrid',
  Onsite: 'onsite',
  NotStated: 'not_stated',
} as const;
export type WorkArrangement = (typeof WorkArrangement)[keyof typeof WorkArrangement];

export const SponsorshipEvidence = {
  Stated: 'stated',
  NotStated: 'not_stated',
  Unverified: 'unverified',
} as const;
export type SponsorshipEvidence = (typeof SponsorshipEvidence)[keyof typeof SponsorshipEvidence];

export const RequirementCheck = {
  Met: 'met',
  NotMet: 'not_met',
  Unknown: 'unknown',
} as const;
export type RequirementCheck = (typeof RequirementCheck)[keyof typeof RequirementCheck];

export const ApprovalState = {
  Pending: 'pending',
  Approved: 'approved',
  Rejected: 'rejected',
  Expired: 'expired',
} as const;
export type ApprovalState = (typeof ApprovalState)[keyof typeof ApprovalState];

export const PauseScope = {
  All: 'all',
  Track: 'track',
} as const;
export type PauseScope = (typeof PauseScope)[keyof typeof PauseScope];

export const PauseDuration = {
  Days: 'days',
  Months: 'months',
  Years: 'years',
  Indefinite: 'indefinite',
  Until: 'until',
} as const;
export type PauseDuration = (typeof PauseDuration)[keyof typeof PauseDuration];

export const SubmissionWindowKind = {
  AsSoonAsReady: 'as_soon_as_ready',
  DailyWindow: 'daily_window',
} as const;
export type SubmissionWindowKind = (typeof SubmissionWindowKind)[keyof typeof SubmissionWindowKind];

export const ContactKind = {
  Email: 'email',
  Phone: 'phone',
} as const;
export type ContactKind = (typeof ContactKind)[keyof typeof ContactKind];

export const TimelineActor = {
  System: 'system',
  User: 'user',
  Employer: 'employer',
  Admin: 'admin',
} as const;
export type TimelineActor = (typeof TimelineActor)[keyof typeof TimelineActor];

export const StatusTone = {
  Neutral: 'neutral',
  Info: 'info',
  Success: 'success',
  Warning: 'warning',
  Danger: 'danger',
  Primary: 'primary',
} as const;
export type StatusTone = (typeof StatusTone)[keyof typeof StatusTone];

export const UserAccountStatus = {
  Registered: 'registered',
  Active: 'active',
  Paused: 'paused',
  Suspended: 'suspended',
  PendingDeletion: 'pending_deletion',
  Deleted: 'deleted',
} as const;
export type UserAccountStatus = (typeof UserAccountStatus)[keyof typeof UserAccountStatus];

export const SourceStatus = {
  Healthy: 'healthy',
  Degraded: 'degraded',
  Failing: 'failing',
  Disabled: 'disabled',
} as const;
export type SourceStatus = (typeof SourceStatus)[keyof typeof SourceStatus];

export const SourceReview = {
  Approved: 'approved',
  Pending: 'pending',
  Rejected: 'rejected',
} as const;
export type SourceReview = (typeof SourceReview)[keyof typeof SourceReview];

export const OpportunityStatus = {
  Active: 'active',
  Expired: 'expired',
  Flagged: 'flagged',
  Duplicate: 'duplicate',
} as const;
export type OpportunityStatus = (typeof OpportunityStatus)[keyof typeof OpportunityStatus];

export const AdminRole = {
  SuperAdmin: 'super_admin',
  Support: 'support',
  Operations: 'operations',
  ReadOnly: 'read_only',
} as const;
export type AdminRole = (typeof AdminRole)[keyof typeof AdminRole];

export const AdminArea = {
  Dashboard: 'dashboard',
  Users: 'users',
  Opportunities: 'opportunities',
  Sources: 'sources',
  Applications: 'applications',
  Settings: 'settings',
  Audit: 'audit',
  Admins: 'admins',
} as const;
export type AdminArea = (typeof AdminArea)[keyof typeof AdminArea];

export const PermissionAction = {
  Read: 'read',
  Create: 'create',
  Update: 'update',
  Delete: 'delete',
} as const;
export type PermissionAction = (typeof PermissionAction)[keyof typeof PermissionAction];

export const EmergencyStopScope = {
  AllUsers: 'all_users',
  Source: 'source',
  Route: 'route',
} as const;
export type EmergencyStopScope = (typeof EmergencyStopScope)[keyof typeof EmergencyStopScope];

export const ServiceHealth = {
  Up: 'up',
  Degraded: 'degraded',
  Down: 'down',
} as const;
export type ServiceHealth = (typeof ServiceHealth)[keyof typeof ServiceHealth];

export const ActorType = {
  User: 'user',
  Admin: 'admin',
  System: 'system',
  Agent: 'agent',
} as const;
export type ActorType = (typeof ActorType)[keyof typeof ActorType];

export const ProfileFieldType = {
  Text: 'text',
  Textarea: 'textarea',
  Url: 'url',
  Email: 'email',
  Phone: 'phone',
  Month: 'month',
  Year: 'year',
  Number: 'number',
  Select: 'select',
  Boolean: 'boolean',
} as const;
export type ProfileFieldType = (typeof ProfileFieldType)[keyof typeof ProfileFieldType];

export const CompletenessKind = {
  Basics: 'basics',
  Photo: 'photo',
  Contacts: 'contacts',
  Skills: 'skills',
  Documents: 'documents',
  Section: 'section',
} as const;
export type CompletenessKind = (typeof CompletenessKind)[keyof typeof CompletenessKind];

export const ProfileBlock = {
  About: 'about',
  Contacts: 'contacts',
  Skills: 'skills',
  Documents: 'documents',
} as const;
export type ProfileBlock = (typeof ProfileBlock)[keyof typeof ProfileBlock];

export const LanguageProficiency = {
  Native: 'native',
  Fluent: 'fluent',
  Professional: 'professional',
  Intermediate: 'intermediate',
  Basic: 'basic',
} as const;
export type LanguageProficiency = (typeof LanguageProficiency)[keyof typeof LanguageProficiency];

export const DocumentKind = {
  Cv: 'cv',
  CoverLetter: 'cover_letter',
  Certificate: 'certificate',
  Transcript: 'transcript',
  Identity: 'identity',
  Other: 'other',
} as const;
export type DocumentKind = (typeof DocumentKind)[keyof typeof DocumentKind];

export const AnswerTopic = {
  WorkAuthorization: 'work_authorization',
  Sponsorship: 'sponsorship',
  NoticePeriod: 'notice_period',
  StartDate: 'start_date',
  SalaryExpectation: 'salary_expectation',
  Relocation: 'relocation',
  Experience: 'experience',
  Eligibility: 'eligibility',
  Other: 'other',
} as const;
export type AnswerTopic = (typeof AnswerTopic)[keyof typeof AnswerTopic];

export const TaskKind = {
  FollowUp: 'follow_up',
  Interview: 'interview',
  Assessment: 'assessment',
  Reference: 'reference',
  Communication: 'communication',
  Other: 'other',
} as const;
export type TaskKind = (typeof TaskKind)[keyof typeof TaskKind];

export const TaskStatus = {
  Open: 'open',
  Done: 'done',
  Dismissed: 'dismissed',
} as const;
export type TaskStatus = (typeof TaskStatus)[keyof typeof TaskStatus];

export const EnumKey = {
  SubmissionStatus: 'submission_status',
  OutcomeStatus: 'outcome_status',
  OpportunityDecision: 'opportunity_decision',
  TrackKind: 'track_kind',
  ApplicationMode: 'application_mode',
  ApplicationRoute: 'application_route',
  OpportunityType: 'opportunity_type',
  WorkArrangement: 'work_arrangement',
  SponsorshipEvidence: 'sponsorship_evidence',
  RequirementCheck: 'requirement_check',
  ApprovalState: 'approval_state',
  UserAccountStatus: 'user_account_status',
  SourceStatus: 'source_status',
  SourceReview: 'source_review',
  OpportunityStatus: 'opportunity_status',
  AdminRole: 'admin_role',
  ServiceHealth: 'service_health',
  ActorType: 'actor_type',
  LanguageProficiency: 'language_proficiency',
  DocumentKind: 'document_kind',
  TaskKind: 'task_kind',
  TaskStatus: 'task_status',
  AnswerTopic: 'answer_topic',
} as const;
export type EnumKey = (typeof EnumKey)[keyof typeof EnumKey];

export function enumValues<T extends Record<string, string>>(enumObject: T): Array<T[keyof T]> {
  return Object.values(enumObject) as Array<T[keyof T]>;
}

export const MessageKind = {
  Text: 'text',
  Image: 'image',
  Voice: 'voice',
  File: 'file',
} as const;
export type MessageKind = (typeof MessageKind)[keyof typeof MessageKind];

export const DevicePlatform = {
  Android: 'android',
  Ios: 'ios',
} as const;
export type DevicePlatform = (typeof DevicePlatform)[keyof typeof DevicePlatform];

export const MessageState = {
  Sent: 'sent',
  Delivered: 'delivered',
  Read: 'read',
} as const;
export type MessageState = (typeof MessageState)[keyof typeof MessageState];

export const ConversationKind = {
  Direct: 'direct',
  Team: 'team',
} as const;
export type ConversationKind = (typeof ConversationKind)[keyof typeof ConversationKind];

export const NotificationKind = {
  Message: 'message',
  TeamMessage: 'team_message',
  ApplicationSubmitted: 'application_submitted',
  ApplicationConfirmed: 'application_confirmed',
} as const;
export type NotificationKind = (typeof NotificationKind)[keyof typeof NotificationKind];

export const NotificationTarget = {
  Conversation: 'conversation',
  Application: 'application',
} as const;
export type NotificationTarget = (typeof NotificationTarget)[keyof typeof NotificationTarget];

export function isEnumValue<T extends Record<string, string>>(enumObject: T, value: unknown): value is T[keyof T] {
  return typeof value === 'string' && (Object.values(enumObject) as string[]).includes(value);
}
