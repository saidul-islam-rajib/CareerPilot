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
  Date: 'date',
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
  BdExam: 'bd_exam',
  ResultScale: 'result_scale',
  AddressKind: 'address_kind',
  SpecialStatus: 'special_status',
  Citizenship: 'citizenship',
  BdDivision: 'bd_division',
  BdDistrict: 'bd_district',
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

export const BdExam = {
  Ssc: 'ssc',
  Dakhil: 'dakhil',
  OLevel: 'o_level',
  Hsc: 'hsc',
  Alim: 'alim',
  ALevel: 'a_level',
  Diploma: 'diploma',
  BachelorHonours: 'bachelor_honours',
  BachelorPass: 'bachelor_pass',
  Masters: 'masters',
  Mbbs: 'mbbs',
  Other: 'other',
} as const;
export type BdExam = (typeof BdExam)[keyof typeof BdExam];

export const ResultScale = {
  Gpa5: 'gpa_5',
  Cgpa4: 'cgpa_4',
  Division: 'division',
  Class: 'class',
  Grade: 'grade',
} as const;
export type ResultScale = (typeof ResultScale)[keyof typeof ResultScale];

export const AddressKind = {
  Present: 'present',
  Permanent: 'permanent',
} as const;
export type AddressKind = (typeof AddressKind)[keyof typeof AddressKind];

export const SpecialStatus = {
  FreedomFighterChild: 'freedom_fighter_child',
  FreedomFighterGrandchild: 'freedom_fighter_grandchild',
  PersonWithDisability: 'person_with_disability',
  EthnicMinority: 'ethnic_minority',
  AnsarVdp: 'ansar_vdp',
  Orphan: 'orphan',
  Other: 'other',
} as const;
export type SpecialStatus = (typeof SpecialStatus)[keyof typeof SpecialStatus];

export const Citizenship = {
  ByBirth: 'by_birth',
  ByDescent: 'by_descent',
  Other: 'other',
} as const;
export type Citizenship = (typeof Citizenship)[keyof typeof Citizenship];

export const ConsistencyKind = {
  Name: 'name',
  DateOfBirth: 'date_of_birth',
  FatherName: 'father_name',
  MotherName: 'mother_name',
  PhoneFormat: 'phone_format',
} as const;
export type ConsistencyKind = (typeof ConsistencyKind)[keyof typeof ConsistencyKind];

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
  ApplicationReply: 'application_reply',
  IntegrationAttention: 'integration_attention',
  AutomationAttention: 'automation_attention',
} as const;
export type NotificationKind = (typeof NotificationKind)[keyof typeof NotificationKind];

export const NotificationTarget = {
  Conversation: 'conversation',
  Application: 'application',
  Integration: 'integration',
  Automation: 'automation',
} as const;
export type NotificationTarget = (typeof NotificationTarget)[keyof typeof NotificationTarget];

export const DeadlineAction = {
  NotifyAndAsk: 'notify_and_ask',
  SubmitEarliest: 'submit_earliest',
  Skip: 'skip',
} as const;
export type DeadlineAction = (typeof DeadlineAction)[keyof typeof DeadlineAction];

export const DryRunOutcome = {
  WouldApply: 'would_apply',
  Deferred: 'deferred',
  Skipped: 'skipped',
} as const;
export type DryRunOutcome = (typeof DryRunOutcome)[keyof typeof DryRunOutcome];

export const SkipReason = {
  EmergencyStop: 'emergency_stop',
  Paused: 'paused',
  Inactive: 'inactive',
  TrackNotAutomatic: 'track_not_automatic',
  HardRequirementFailed: 'hard_requirement_failed',
  UnknownRequirement: 'unknown_requirement',
  ExcludedCountry: 'excluded_country',
  NoMatchingRule: 'no_matching_rule',
  BelowScore: 'below_score',
  CountryNotAllowed: 'country_not_allowed',
  RouteNotAllowed: 'route_not_allowed',
  ExcludedEmployer: 'excluded_employer',
  ExcludedKeyword: 'excluded_keyword',
  RuleExpired: 'rule_expired',
  UserOnlyStep: 'user_only_step',
  CvMissing: 'cv_missing',
  DeadlineAtRisk: 'deadline_at_risk',
  DeadlinePassed: 'deadline_passed',
  DailyCap: 'daily_cap',
  WeeklyCap: 'weekly_cap',
  RuleCap: 'rule_cap',
  OutsideWindow: 'outside_window',
} as const;
export type SkipReason = (typeof SkipReason)[keyof typeof SkipReason];

export const SkipStage = {
  Rule: 'rule',
  Safeguard: 'safeguard',
  Schedule: 'schedule',
} as const;
export type SkipStage = (typeof SkipStage)[keyof typeof SkipStage];

export const SubmissionHold = {
  EmergencyStop: 'emergency_stop',
  Paused: 'paused',
  OutsideWindow: 'outside_window',
  DailyLimit: 'daily_limit',
  WeeklyLimit: 'weekly_limit',
  RuleLimit: 'rule_limit',
  RuleInactive: 'rule_inactive',
  Inactive: 'inactive',
  DeadlineAtRisk: 'deadline_at_risk',
  DeadlineSkipped: 'deadline_skipped',
} as const;
export type SubmissionHold = (typeof SubmissionHold)[keyof typeof SubmissionHold];

export function isEnumValue<T extends Record<string, string>>(enumObject: T, value: unknown): value is T[keyof T] {
  return typeof value === 'string' && (Object.values(enumObject) as string[]).includes(value);
}

export const ReportPeriod = {
  Daily: 'daily',
  Weekly: 'weekly',
} as const;
export type ReportPeriod = (typeof ReportPeriod)[keyof typeof ReportPeriod];

export const ReportBucket = {
  Submitted: 'submitted',
  Confirmed: 'confirmed',
  Failed: 'failed',
  Waiting: 'waiting',
  Other: 'other',
} as const;
export type ReportBucket = (typeof ReportBucket)[keyof typeof ReportBucket];

export const ExportKind = {
  Applications: 'applications',
  Report: 'report',
  Application: 'application',
  Archive: 'archive',
} as const;
export type ExportKind = (typeof ExportKind)[keyof typeof ExportKind];

export const ExportFormat = {
  Csv: 'csv',
  Pdf: 'pdf',
  Zip: 'zip',
} as const;
export type ExportFormat = (typeof ExportFormat)[keyof typeof ExportFormat];

export const ExportStatus = {
  Queued: 'queued',
  Running: 'running',
  Ready: 'ready',
  Failed: 'failed',
  Expired: 'expired',
} as const;
export type ExportStatus = (typeof ExportStatus)[keyof typeof ExportStatus];

export const DeletionStatus = {
  Requested: 'requested',
  Cancelled: 'cancelled',
  Completed: 'completed',
} as const;
export type DeletionStatus = (typeof DeletionStatus)[keyof typeof DeletionStatus];

export const DeletionScope = {
  Profile: 'profile',
  Documents: 'documents',
  Applications: 'applications',
  Answers: 'answers',
  Preferences: 'preferences',
  SignInHistory: 'sign_in_history',
  ConnectedAccounts: 'connected_accounts',
  Devices: 'devices',
  Messages: 'messages',
} as const;
export type DeletionScope = (typeof DeletionScope)[keyof typeof DeletionScope];

export const RetainedRecord = {
  AuditEvents: 'audit_events',
  ConsentRecords: 'consent_records',
  DeletionRecord: 'deletion_record',
} as const;
export type RetainedRecord = (typeof RetainedRecord)[keyof typeof RetainedRecord];

export const ExternalData = {
  EmployerCopies: 'employer_copies',
  PortalAccounts: 'portal_accounts',
} as const;
export type ExternalData = (typeof ExternalData)[keyof typeof ExternalData];

export const ConsentKind = {
  Terms: 'terms',
  Privacy: 'privacy',
  Analytics: 'analytics',
  PreciseLocation: 'precise_location',
  Marketing: 'marketing',
  AiImprovement: 'ai_improvement',
} as const;
export type ConsentKind = (typeof ConsentKind)[keyof typeof ConsentKind];

export const ConnectionStatus = {
  Connected: 'connected',
  NeedsReconnect: 'needs_reconnect',
} as const;
export type ConnectionStatus = (typeof ConnectionStatus)[keyof typeof ConnectionStatus];

export const SyncFailure = {
  TokenRevoked: 'token_revoked',
  GoogleUnavailable: 'google_unavailable',
  GoogleRejected: 'google_rejected',
  MissingMailAccess: 'missing_mail_access',
} as const;
export type SyncFailure = (typeof SyncFailure)[keyof typeof SyncFailure];

export const ConnectFailure = {
  AccessDenied: 'access_denied',
  InvalidState: 'invalid_state',
  ExchangeFailed: 'exchange_failed',
  NotConfigured: 'not_configured',
} as const;
export type ConnectFailure = (typeof ConnectFailure)[keyof typeof ConnectFailure];

export const IntegrationProvider = {
  Google: 'google',
} as const;
export type IntegrationProvider = (typeof IntegrationProvider)[keyof typeof IntegrationProvider];

export const CircularStatus = {
  Draft: 'draft',
  Published: 'published',
  Withdrawn: 'withdrawn',
} as const;
export type CircularStatus = (typeof CircularStatus)[keyof typeof CircularStatus];

export const CircularPhase = {
  Upcoming: 'upcoming',
  Open: 'open',
  Closed: 'closed',
} as const;
export type CircularPhase = (typeof CircularPhase)[keyof typeof CircularPhase];

export const QuotaKind = {
  General: 'general',
  FreedomFighter: 'freedom_fighter',
  EthnicMinority: 'ethnic_minority',
  PersonWithDisability: 'person_with_disability',
  AnsarVdp: 'ansar_vdp',
  Orphan: 'orphan',
  Women: 'women',
  District: 'district',
} as const;
export type QuotaKind = (typeof QuotaKind)[keyof typeof QuotaKind];

export const DistrictBasis = {
  HomeDistrict: 'home_district',
  PermanentAddress: 'permanent_address',
  PresentAddress: 'present_address',
} as const;
export type DistrictBasis = (typeof DistrictBasis)[keyof typeof DistrictBasis];

export const CriterionKind = {
  Citizenship: 'citizenship',
  Age: 'age',
  Education: 'education',
  District: 'district',
} as const;
export type CriterionKind = (typeof CriterionKind)[keyof typeof CriterionKind];

export const Eligibility = {
  Met: 'met',
  NotMet: 'not_met',
  Unknown: 'unknown',
} as const;
export type Eligibility = (typeof Eligibility)[keyof typeof Eligibility];

export const EligibilityReason = {
  ProfileMissing: 'profile_missing',
  CutoffNotStated: 'cutoff_not_stated',
  AboveMaximum: 'above_maximum',
  BelowMinimum: 'below_minimum',
  RelaxationUnverified: 'relaxation_unverified',
  RelaxationApplied: 'relaxation_applied',
  RecordMissing: 'record_missing',
  ScaleDiffers: 'scale_differs',
  ResultBelow: 'result_below',
  SubjectMismatch: 'subject_mismatch',
  SubjectMissing: 'subject_missing',
  DistrictOutside: 'district_outside',
  NotACitizen: 'not_a_citizen',
  Satisfied: 'satisfied',
} as const;
export type EligibilityReason = (typeof EligibilityReason)[keyof typeof EligibilityReason];

export const GovApplicationStatus = {
  Preparing: 'preparing',
  Submitted: 'submitted',
  Confirmed: 'confirmed',
  Withdrawn: 'withdrawn',
} as const;
export type GovApplicationStatus = (typeof GovApplicationStatus)[keyof typeof GovApplicationStatus];

export const FeeStatus = {
  NotRequired: 'not_required',
  Due: 'due',
  Unconfirmed: 'unconfirmed',
  Paid: 'paid',
} as const;
export type FeeStatus = (typeof FeeStatus)[keyof typeof FeeStatus];

export const PaymentMethod = {
  MobileBanking: 'mobile_banking',
  Sms: 'sms',
  Bank: 'bank',
  Other: 'other',
} as const;
export type PaymentMethod = (typeof PaymentMethod)[keyof typeof PaymentMethod];

export const FeeUrgency = {
  None: 'none',
  Ok: 'ok',
  DueSoon: 'due_soon',
  Overdue: 'overdue',
} as const;
export type FeeUrgency = (typeof FeeUrgency)[keyof typeof FeeUrgency];

export const GovStage = {
  Application: 'application',
  AdmitCard: 'admit_card',
  Preliminary: 'preliminary',
  Written: 'written',
  Practical: 'practical',
  Viva: 'viva',
  DocumentVerification: 'document_verification',
  PoliceVerification: 'police_verification',
  Medical: 'medical',
  Result: 'result',
} as const;
export type GovStage = (typeof GovStage)[keyof typeof GovStage];

export const StageStatus = {
  Expected: 'expected',
  Scheduled: 'scheduled',
  Rescheduled: 'rescheduled',
  Done: 'done',
  Passed: 'passed',
  Failed: 'failed',
} as const;
export type StageStatus = (typeof StageStatus)[keyof typeof StageStatus];

export const EvidenceSource = {
  OfficialNotice: 'official_notice',
  UserEntry: 'user_entry',
} as const;
export type EvidenceSource = (typeof EvidenceSource)[keyof typeof EvidenceSource];

export const NoticeKind = {
  Correction: 'correction',
  Amendment: 'amendment',
  Reschedule: 'reschedule',
  AdmitCard: 'admit_card',
  Result: 'result',
  Verification: 'verification',
  Other: 'other',
} as const;
export type NoticeKind = (typeof NoticeKind)[keyof typeof NoticeKind];

export const DayKind = {
  Working: 'working',
  Weekend: 'weekend',
  Holiday: 'holiday',
} as const;
export type DayKind = (typeof DayKind)[keyof typeof DayKind];

export const DeadlineSubject = {
  ApplicationClose: 'application_close',
  FeePayment: 'fee_payment',
  Stage: 'stage',
} as const;
export type DeadlineSubject = (typeof DeadlineSubject)[keyof typeof DeadlineSubject];

export const GuideStepKind = {
  CheckEligibility: 'check_eligibility',
  PreparePhotoSignature: 'prepare_photo_signature',
  OpenOfficialSite: 'open_official_site',
  CompleteVerification: 'complete_verification',
  SubmitForm: 'submit_form',
  SaveApplicantCopy: 'save_applicant_copy',
  PayFee: 'pay_fee',
  ConfirmPayment: 'confirm_payment',
} as const;
export type GuideStepKind = (typeof GuideStepKind)[keyof typeof GuideStepKind];

export const GuideActor = {
  User: 'user',
  System: 'system',
} as const;
export type GuideActor = (typeof GuideActor)[keyof typeof GuideActor];

export const ConnectorFailure = {
  HostNotAllowed: 'host_not_allowed',
  Unreachable: 'unreachable',
  NoContent: 'no_content',
} as const;
export type ConnectorFailure = (typeof ConnectorFailure)[keyof typeof ConnectorFailure];

export const Weekday = {
  Monday: 'monday',
  Tuesday: 'tuesday',
  Wednesday: 'wednesday',
  Thursday: 'thursday',
  Friday: 'friday',
  Saturday: 'saturday',
  Sunday: 'sunday',
} as const;
export type Weekday = (typeof Weekday)[keyof typeof Weekday];

export const SecretKind = {
  ApplicationId: 'application_id',
  UserId: 'user_id',
  Password: 'password',
  RollNumber: 'roll_number',
  TransactionId: 'transaction_id',
} as const;
export type SecretKind = (typeof SecretKind)[keyof typeof SecretKind];

export const WritingKind = {
  CoverLetter: 'cover_letter',
  TailoredCv: 'tailored_cv',
  Essay: 'essay',
  Statement: 'statement',
} as const;
export type WritingKind = (typeof WritingKind)[keyof typeof WritingKind];

export const DraftSource = {
  Template: 'template',
  Ai: 'ai',
  User: 'user',
} as const;
export type DraftSource = (typeof DraftSource)[keyof typeof DraftSource];

export const WritingTone = {
  Professional: 'professional',
  Friendly: 'friendly',
  Concise: 'concise',
} as const;
export type WritingTone = (typeof WritingTone)[keyof typeof WritingTone];

export const IssueKind = {
  UnsupportedClaim: 'unsupported_claim',
  OtherEmployer: 'other_employer',
  Placeholder: 'placeholder',
  MissingTarget: 'missing_target',
  OverLimit: 'over_limit',
  Empty: 'empty',
} as const;
export type IssueKind = (typeof IssueKind)[keyof typeof IssueKind];

export const DraftStatus = {
  Ready: 'ready',
  NeedsFixes: 'needs_fixes',
} as const;
export type DraftStatus = (typeof DraftStatus)[keyof typeof DraftStatus];

export const WritingProvider = {
  Template: 'template',
  Ai: 'ai',
} as const;
export type WritingProvider = (typeof WritingProvider)[keyof typeof WritingProvider];

export const StudyKind = {
  TaughtMasters: 'taught_masters',
  ResearchMasters: 'research_masters',
  Phd: 'phd',
  Scholarship: 'scholarship',
  Fellowship: 'fellowship',
  ResearchAssistantship: 'research_assistantship',
  TeachingAssistantship: 'teaching_assistantship',
  Exchange: 'exchange',
  SummerSchool: 'summer_school',
  Postdoc: 'postdoc',
  Internship: 'internship',
} as const;
export type StudyKind = (typeof StudyKind)[keyof typeof StudyKind];

export const IntakeTerm = {
  Fall: 'fall',
  Spring: 'spring',
  Winter: 'winter',
  Summer: 'summer',
} as const;
export type IntakeTerm = (typeof IntakeTerm)[keyof typeof IntakeTerm];

export const EvidenceStatus = {
  Explicit: 'explicit',
  NotStated: 'not_stated',
  Unclear: 'unclear',
  Conflicting: 'conflicting',
} as const;
export type EvidenceStatus = (typeof EvidenceStatus)[keyof typeof EvidenceStatus];

export const NeedLevel = {
  Required: 'required',
  Optional: 'optional',
  NotRequired: 'not_required',
  NotStated: 'not_stated',
} as const;
export type NeedLevel = (typeof NeedLevel)[keyof typeof NeedLevel];

export const ScorePolicy = {
  OfficialOnly: 'official_only',
  SelfReported: 'self_reported',
  Alternative: 'alternative',
  NotStated: 'not_stated',
} as const;
export type ScorePolicy = (typeof ScorePolicy)[keyof typeof ScorePolicy];

export const ExamKind = {
  Ielts: 'ielts',
  Toefl: 'toefl',
  Pte: 'pte',
  Duolingo: 'duolingo',
  Gre: 'gre',
  Gmat: 'gmat',
  Sat: 'sat',
  Act: 'act',
  Other: 'other',
} as const;
export type ExamKind = (typeof ExamKind)[keyof typeof ExamKind];

export const ExamStatus = {
  Planned: 'planned',
  Registered: 'registered',
  Taken: 'taken',
  ScoresReleased: 'scores_released',
  Cancelled: 'cancelled',
} as const;
export type ExamStatus = (typeof ExamStatus)[keyof typeof ExamStatus];

export const DeadlineKind = {
  Application: 'application',
  EarlyDecision: 'early_decision',
  Priority: 'priority',
  ScholarshipConsideration: 'scholarship_consideration',
  Funding: 'funding',
  Referee: 'referee',
  SupervisorContact: 'supervisor_contact',
  DecisionExpected: 'decision_expected',
  Acceptance: 'acceptance',
  Deposit: 'deposit',
  TestRegistration: 'test_registration',
  TestDate: 'test_date',
  ScoreExpiry: 'score_expiry',
  Condition: 'condition',
  Checklist: 'checklist',
} as const;
export type DeadlineKind = (typeof DeadlineKind)[keyof typeof DeadlineKind];

export const FundingStatus = {
  Stated: 'stated',
  NotStated: 'not_stated',
  Unclear: 'unclear',
  None: 'none',
} as const;
export type FundingStatus = (typeof FundingStatus)[keyof typeof FundingStatus];

export const AmountSource = {
  Official: 'official',
  Estimate: 'estimate',
} as const;
export type AmountSource = (typeof AmountSource)[keyof typeof AmountSource];

export const BudgetKind = {
  ApplicationFee: 'application_fee',
  TestFee: 'test_fee',
  ScoreSending: 'score_sending',
  Evaluation: 'evaluation',
  Translation: 'translation',
  Courier: 'courier',
  VisaFee: 'visa_fee',
  Other: 'other',
} as const;
export type BudgetKind = (typeof BudgetKind)[keyof typeof BudgetKind];

export const GradeScale = {
  Cgpa4: 'cgpa_4',
  Gpa5: 'gpa_5',
  Percentage: 'percentage',
  Division: 'division',
  Other: 'other',
} as const;
export type GradeScale = (typeof GradeScale)[keyof typeof GradeScale];

export const CredentialKind = {
  DegreeCertificate: 'degree_certificate',
  Transcript: 'transcript',
  SecondaryCertificate: 'secondary_certificate',
  Other: 'other',
} as const;
export type CredentialKind = (typeof CredentialKind)[keyof typeof CredentialKind];

export const CredentialNeed = {
  Evaluation: 'evaluation',
  CertifiedCopy: 'certified_copy',
  Translation: 'translation',
  Notarization: 'notarization',
  SealedTranscript: 'sealed_transcript',
} as const;
export type CredentialNeed = (typeof CredentialNeed)[keyof typeof CredentialNeed];

export const ItemProgress = {
  Todo: 'todo',
  InProgress: 'in_progress',
  Done: 'done',
} as const;
export type ItemProgress = (typeof ItemProgress)[keyof typeof ItemProgress];

export const ConversionSource = {
  Official: 'official',
  Estimate: 'estimate',
} as const;
export type ConversionSource = (typeof ConversionSource)[keyof typeof ConversionSource];

export const AgreementStatus = {
  NotAsked: 'not_asked',
  Asked: 'asked',
  Agreed: 'agreed',
  Declined: 'declined',
} as const;
export type AgreementStatus = (typeof AgreementStatus)[keyof typeof AgreementStatus];

export const SubmissionMethod = {
  PortalInvite: 'portal_invite',
  Email: 'email',
  Postal: 'postal',
  InstitutionForm: 'institution_form',
  NotStated: 'not_stated',
} as const;
export type SubmissionMethod = (typeof SubmissionMethod)[keyof typeof SubmissionMethod];

export const RecommendationStatus = {
  Planned: 'planned',
  Requested: 'requested',
  Submitted: 'submitted',
  Confirmed: 'confirmed',
} as const;
export type RecommendationStatus = (typeof RecommendationStatus)[keyof typeof RecommendationStatus];

export const ReceiptEvidence = {
  InstitutionConfirmation: 'institution_confirmation',
  UserStatement: 'user_statement',
} as const;
export type ReceiptEvidence = (typeof ReceiptEvidence)[keyof typeof ReceiptEvidence];

export const DraftKind = {
  Request: 'request',
  Reminder: 'reminder',
} as const;
export type DraftKind = (typeof DraftKind)[keyof typeof DraftKind];

export const OutreachStatus = {
  Draft: 'draft',
  Sent: 'sent',
  RepliedPositive: 'replied_positive',
  CallRequested: 'call_requested',
  DocumentsRequested: 'documents_requested',
  RepliedNeutral: 'replied_neutral',
  Declined: 'declined',
  Stopped: 'stopped',
} as const;
export type OutreachStatus = (typeof OutreachStatus)[keyof typeof OutreachStatus];

export const ReplyOutcome = {
  Positive: 'positive',
  CallRequested: 'call_requested',
  DocumentsRequested: 'documents_requested',
  Neutral: 'neutral',
  Declined: 'declined',
  DoNotContact: 'do_not_contact',
} as const;
export type ReplyOutcome = (typeof ReplyOutcome)[keyof typeof ReplyOutcome];

export const ProgramStatus = {
  Saved: 'saved',
  Preparing: 'preparing',
  Submitted: 'submitted',
  Decided: 'decided',
  Withdrawn: 'withdrawn',
} as const;
export type ProgramStatus = (typeof ProgramStatus)[keyof typeof ProgramStatus];

export const PortalSubmission = {
  NotStarted: 'not_started',
  InProgress: 'in_progress',
  SubmittedByUser: 'submitted_by_user',
  ConfirmedByInstitution: 'confirmed_by_institution',
} as const;
export type PortalSubmission = (typeof PortalSubmission)[keyof typeof PortalSubmission];

export const PortalFee = {
  NotRequired: 'not_required',
  Due: 'due',
  PaidByUser: 'paid_by_user',
} as const;
export type PortalFee = (typeof PortalFee)[keyof typeof PortalFee];

export const DecisionKind = {
  Pending: 'pending',
  Accepted: 'accepted',
  ConditionallyAccepted: 'conditionally_accepted',
  Waitlisted: 'waitlisted',
  InterviewInvited: 'interview_invited',
  Rejected: 'rejected',
  Deferred: 'deferred',
} as const;
export type DecisionKind = (typeof DecisionKind)[keyof typeof DecisionKind];

export const UserAction = {
  AcceptOffer: 'accept_offer',
  PayDeposit: 'pay_deposit',
  DeclineOffer: 'decline_offer',
} as const;
export type UserAction = (typeof UserAction)[keyof typeof UserAction];

export const ChecklistStep = {
  AdmissionDocument: 'admission_document',
  ProofOfFunds: 'proof_of_funds',
  Visa: 'visa',
  HealthInsurance: 'health_insurance',
  Accommodation: 'accommodation',
  TuitionPayment: 'tuition_payment',
  Travel: 'travel',
  ArrivalRegistration: 'arrival_registration',
} as const;
export type ChecklistStep = (typeof ChecklistStep)[keyof typeof ChecklistStep];

export const PlanStepKind = {
  TestRegistration: 'test_registration',
  TakeTest: 'take_test',
  SendScores: 'send_scores',
  PrepareDocuments: 'prepare_documents',
  RequestReferees: 'request_referees',
  ContactSupervisor: 'contact_supervisor',
  SubmitApplication: 'submit_application',
} as const;
export type PlanStepKind = (typeof PlanStepKind)[keyof typeof PlanStepKind];

export const WarningKind = {
  ScoreExpiresBeforeDeadline: 'score_expires_before_deadline',
  ScoreExpiresBeforeStart: 'score_expires_before_start',
  NoValidScore: 'no_valid_score',
  RefereeWithoutConsent: 'referee_without_consent',
} as const;
export type WarningKind = (typeof WarningKind)[keyof typeof WarningKind];

export const AttentionKind = {
  OutreachReply: 'outreach_reply',
  DeadlineSoon: 'deadline_soon',
  ScoreWarning: 'score_warning',
  PortalBlocked: 'portal_blocked',
} as const;
export type AttentionKind = (typeof AttentionKind)[keyof typeof AttentionKind];

export const PortalBlocker = {
  SectionIncomplete: 'section_incomplete',
  DocumentMissing: 'document_missing',
  RefereeNotConsented: 'referee_not_consented',
  RefereeNotInvited: 'referee_not_invited',
  FeeDue: 'fee_due',
  InstitutionItemPending: 'institution_item_pending',
  CredentialPending: 'credential_pending',
} as const;
export type PortalBlocker = (typeof PortalBlocker)[keyof typeof PortalBlocker];

export const AcademicFailure = {
  RefereeConsentRequired: 'referee_consent_required',
  EvidenceRequired: 'evidence_required',
  ResearchReferenceRequired: 'research_reference_required',
  ProfileNameRequired: 'profile_name_required',
  OutreachLimit: 'outreach_limit',
  OutreachStopped: 'outreach_stopped',
  OutreachGeneric: 'outreach_generic',
  FollowUpNotAllowed: 'follow_up_not_allowed',
  FollowUpTooSoon: 'follow_up_too_soon',
  ConfirmationRequired: 'confirmation_required',
  NotAnOffer: 'not_an_offer',
  UnknownProgram: 'unknown_program',
  NotAStudyOpportunity: 'not_a_study_opportunity',
  AlreadySent: 'already_sent',
  NotSent: 'not_sent',
  UnknownSection: 'unknown_section',
  TooManyItems: 'too_many_items',
  LimitAboveMaximum: 'limit_above_maximum',
  Duplicate: 'duplicate',
} as const;
export type AcademicFailure = (typeof AcademicFailure)[keyof typeof AcademicFailure];
