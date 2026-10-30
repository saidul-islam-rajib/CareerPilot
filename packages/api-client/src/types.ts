import type {
  AnswerTopic,
  ApplicationMode,
  ApplicationRoute,
  ApprovalState,
  CompletenessKind,
  ContactKind,
  DevicePlatform,
  DocumentKind,
  EnumValueMetadata,
  Money,
  MoneyRange,
  OpportunityDecision,
  OpportunityType,
  OutcomeStatus,
  PauseDuration,
  PauseScope,
  PhotoCrop,
  RequirementCheck,
  SourceReview,
  SourceStatus,
  SponsorshipEvidence,
  SubmissionStatus,
  SubmissionWindowKind,
  TaskKind,
  TaskStatus,
  TimelineActor,
  TrackKind,
  WorkArrangement,
  ConversationKind,
  MessageKind,
  MessageState,
  NotificationKind,
  NotificationTarget,
} from '@careerpilot/domain-ui-logic';
import type { EntryValue, FormLimits, SectionDefinition } from '@careerpilot/dynamic-forms';
import type { ThemeKey } from '@careerpilot/ui-tokens';
import type { ValidationPolicy } from '@careerpilot/validation';

export type IsoDateTime = string;

export interface UserSummary {
  id: string;
  fullName: string;
  email: string;
  photoUrl?: string;
}

export interface Session {
  accessToken: string;
  user: UserSummary;
}

export interface SignInRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  fullName: string;
  email: string;
  consent: boolean;
  consentDocuments: { terms: string; privacy: string };
}

export const AccountLinkPurpose = {
  Setup: 'setup',
  Reset: 'reset',
} as const;
export type AccountLinkPurpose = (typeof AccountLinkPurpose)[keyof typeof AccountLinkPurpose];

export interface AccountLinkDetails {
  purpose: AccountLinkPurpose;
  fullName: string;
  email: string;
}

export interface CompleteAccountLinkRequest {
  token: string;
  password: string;
}

export interface AccountLinkSettings {
  ttlMinutes: number;
  resendCooldownSeconds: number;
  minTtlMinutes: number;
  maxTtlMinutes: number;
}

export interface OpenSourceComponent {
  name: string;
  licence: string;
  url: string;
}

export interface DisplaySettings {
  strongMatchScore: number;
  fairMatchScore: number;
  urgentDeadlineDays: number;
}

export interface PublicConfig {
  theme: ThemeKey;
  display: DisplaySettings;
  locale: string;
  defaultTimeZone: string;
  enumValues: EnumValueMetadata[];
  validationPolicy: ValidationPolicy;
  pauseOptions: PauseOption[];
  accountDeletionGraceDays: number;
  legal: { termsUrl: string; privacyUrl: string; termsVersion: string; privacyVersion: string };
  branding: { productName: string; developerName: string; developerUrl: string };
  openSourceComponents: OpenSourceComponent[];
  notifications: NotificationSettings;
  verification: VerificationSettings;
  accountLinks: AccountLinkSettings;
  tracking: TrackingSettings;
  answers: AnswerSettings;
  jobSources: JobSourceSettings;
  profile: ProfileSettings;
}

export interface JobSourceSettings {
  maxPerUser: number;
  minLimit: number;
  maxLimit: number;
}

export interface VerificationSettings {
  codeLength: number;
  codeTtlSeconds: number;
  resendCooldownSeconds: number;
  smsEnabled: boolean;
}

export interface VerificationChallenge {
  destination: string;
  expiresAt: IsoDateTime;
  resendAfterSeconds: number;
}

export interface DigestTimePreset {
  key: string;
  time: string;
}

export interface NotificationSettings {
  defaultDigestTime: string;
  digestTimePresets: DigestTimePreset[];
}

export interface PauseOption {
  duration: PauseDuration;
  amount?: number;
}

export interface Track {
  id: string;
  kind: TrackKind;
  name?: string;
  resultCount: number;
  mode: ApplicationMode;
  position: number;
}

export interface OpportunitySummary {
  id: string;
  type: OpportunityType;
  title: string;
  organization: string;
  location: string;
  countryCode: string;
  workArrangement: WorkArrangement;
  matchScore: number;
  deadline?: IsoDateTime;
  compensation?: MoneyRange;
  sponsorship?: SponsorshipEvidence;
  hasHardFailure: boolean;
  decision?: OpportunityDecision;
  missingSkills: string[];
}

export interface MatchFactor {
  text: string;
  positive: boolean;
}

export interface RequirementItem {
  text: string;
  check: RequirementCheck;
  hard: boolean;
}

export interface ArchivedCircular {
  archivedAt: IsoDateTime;
  originalUrl: string;
  text: string;
}

export interface OpportunityDetail extends OpportunitySummary {
  description: string;
  matchFactors: MatchFactor[];
  requirements: RequirementItem[];
  source: { name: string; url: string; checkedAt: IsoDateTime };
  circular: ArchivedCircular;
  route: ApplicationRoute;
  applicationEmail?: string;
}

export interface TrackDigest {
  track: Track;
  opportunities: OpportunitySummary[];
}

export interface PauseState {
  scope: PauseScope;
  until?: IsoDateTime;
  startedAt: IsoDateTime;
}

export interface DashboardSummary {
  counts: { newMatches: number; awaitingApproval: number; appliedThisWeek: number; interviews: number };
  pause?: PauseState;
  lastCheckedAt: IsoDateTime;
  tracks: TrackDigest[];
  upcoming: UpcomingTask[];
  homeCountry: string;
  favoriteCompanies: string[];
}

export const AnswerSource = {
  Profile: 'profile',
  Ai: 'ai',
  User: 'user',
  Saved: 'saved',
} as const;
export type AnswerSource = (typeof AnswerSource)[keyof typeof AnswerSource];

export interface QuestionAnswer {
  id: string;
  question: string;
  answer: string;
  source: AnswerSource;
}

export interface ApprovalSummary {
  id: string;
  opportunity: OpportunitySummary;
  state: ApprovalState;
  createdAt: IsoDateTime;
  expiresAt: IsoDateTime;
}

export interface ApprovalDetail extends ApprovalSummary {
  route: ApplicationRoute;
  materials: {
    cv: { name: string; version: number; documentId?: string };
    coverLetter: string;
    answers: QuestionAnswer[];
  };
  submissionWindowLabel?: string;
}

export interface TimelineEntry {
  at: IsoDateTime;
  actor: TimelineActor;
  text: string;
  status?: SubmissionStatus;
}

export interface SentEmail {
  subject: string;
  to: string;
  sentAt: IsoDateTime;
  body: string;
}

export interface SentFile {
  name: string;
  version: number;
  sizeBytes: number;
}

export interface Evidence {
  text: string;
  at: IsoDateTime;
}

export interface ApplicationSummary {
  id: string;
  opportunity: OpportunitySummary;
  submissionStatus: SubmissionStatus;
  outcomeStatus: OutcomeStatus;
  appliedAt?: IsoDateTime;
  updatedAt: IsoDateTime;
  lastContactAt?: IsoDateTime;
}

export interface ApplicationRecord extends ApplicationSummary {
  route: ApplicationRoute;
  timeline: TimelineEntry[];
  questions: QuestionAnswer[];
  emails: SentEmail[];
  files: SentFile[];
  evidence: Evidence[];
  circular: ArchivedCircular;
  tasks: FollowUpTask[];
  archivedAt?: IsoDateTime;
}

export interface FollowUpTask {
  id: string;
  kind: TaskKind;
  title: string;
  dueAt?: IsoDateTime;
  location: string;
  notes: string;
  status: TaskStatus;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export interface TaskInput {
  kind: TaskKind;
  title: string;
  dueAt?: IsoDateTime;
  location: string;
  notes: string;
}

export interface OutcomeUpdate {
  outcome: OutcomeStatus;
  note?: string;
}

export interface UpcomingTask {
  applicationId: string;
  organization: string;
  title: string;
  task: FollowUpTask;
}

export interface TrackingSettings {
  taskTitleMaxLength: number;
  taskNotesMaxLength: number;
  taskLocationMaxLength: number;
  outcomeNoteMaxLength: number;
  upcomingDays: number;
  upcomingLimit: number;
  followUpAfterDays: number;
  defaultTaskTime: string;
}

export const ApplicationFilter = {
  All: 'all',
  Active: 'active',
  Submitted: 'submitted',
  Attention: 'attention',
} as const;
export type ApplicationFilter = (typeof ApplicationFilter)[keyof typeof ApplicationFilter];

export interface Contact {
  id: string;
  kind: ContactKind;
  value: string;
  label: string;
  isPrimary: boolean;
  verified: boolean;
  position: number;
}

export interface ProfileEntry {
  id: string;
  position: number;
  values: Record<string, EntryValue>;
  updatedAt: IsoDateTime;
}

export interface FileInfo {
  fileName: string;
  contentType: string;
  sizeBytes: number;
  uploadedAt: IsoDateTime;
  url: string;
}

export interface DocumentVersion extends FileInfo {
  version: number;
}

export interface ProfileDocument {
  id: string;
  name: string;
  kind: DocumentKind;
  position: number;
  version: number;
  updatedAt: IsoDateTime;
  file: DocumentVersion;
  versions: DocumentVersion[];
}

export interface CompletenessItem {
  key: string;
  weight: number;
  done: boolean;
}

export interface Profile {
  id: string;
  fullName: string;
  headline: string;
  location: string;
  countryCode?: string;
  summary: string;
  photoUrl?: string;
  photoCrop?: PhotoCrop;
  signatureUrl?: string;
  completeness: number;
  completenessItems: CompletenessItem[];
  contacts: Contact[];
  skills: string[];
  sections: Record<string, ProfileEntry[]>;
  documents: ProfileDocument[];
}

export interface ProfileLimits extends FormLimits {
  maxContacts: number;
  maxSkills: number;
  maxSkillLength: number;
  maxEntriesPerSection: number;
  maxDocuments: number;
  headlineMaxLength: number;
  locationMaxLength: number;
  summaryMaxLength: number;
  contactLabelMaxLength: number;
  documentNameMaxLength: number;
  minSkillsForCompleteness: number;
}

export interface UploadLimits {
  maxDocumentBytes: number;
  maxPhotoBytes: number;
  documentTypes: string[];
  photoTypes: string[];
}

export interface CompletenessRule {
  kind: CompletenessKind;
  weight: number;
  section?: string;
}

export interface ProfileSettings {
  pageOrder: string[];
  sections: SectionDefinition[];
  limits: ProfileLimits;
  uploads: UploadLimits;
  completeness: CompletenessRule[];
}

export interface UploadSource {
  name: string;
  type: string;
  size: number;
  blob?: Blob;
  uri?: string;
  bytes?: () => Promise<Uint8Array>;
}

export interface BasicsChanges {
  fullName?: string;
  headline?: string;
  location?: string;
  countryCode?: string;
  summary?: string;
}

export interface ContactInput {
  kind: ContactKind;
  value: string;
  label: string;
}

export interface ContactChanges {
  value?: string;
  label?: string;
}

export interface DocumentInput {
  file: UploadSource;
  name?: string;
  kind: DocumentKind;
}

export interface DocumentChanges {
  name?: string;
  kind?: DocumentKind;
}

export interface PasswordChange {
  currentPassword: string;
  newPassword: string;
}

export interface SubmissionWindow {
  kind: SubmissionWindowKind;
  start?: string;
  end?: string;
}

export interface NotificationPreferences {
  digestEnabled: boolean;
  digestTime?: string;
}

export interface Settings {
  tracks: Track[];
  submissionWindow: SubmissionWindow;
  pause?: PauseState;
  timeZone: string;
  notifications: NotificationPreferences;
  excludedCountries: string[];
  favoriteCompanies: string[];
  homeCountry: string;
  discoverable: boolean;
  blockedUsers: string[];
}

export interface TrackUpdate {
  resultCount?: number;
  mode?: ApplicationMode;
}

export interface SignInEvent {
  id: string;
  at: IsoDateTime;
  ip: string;
  device: string;
  approximateLocation: string;
  success: boolean;
  current: boolean;
}

export interface DeletionRequest {
  scheduledFor: IsoDateTime;
}

export type { Money };

export interface SavedAnswer {
  id: string;
  topic: AnswerTopic;
  question: string;
  answer: string;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export interface SavedAnswerInput {
  topic: AnswerTopic;
  question: string;
  answer: string;
}

export interface UserSource {
  id: string;
  name: string;
  siteUrl: string;
  status: SourceStatus;
  review: SourceReview;
  jobsFound: number;
  addedAt?: IsoDateTime;
  lastCheckedAt?: IsoDateTime;
  lastError?: string;
  reviewNote?: string;
  arrangements: Partial<Record<WorkArrangement, number>>;
}

export interface SourceJob {
  id: string;
  title: string;
  location: string;
  countryCode: string;
  workArrangement: WorkArrangement;
  deadline?: IsoDateTime;
  url: string;
  listed: boolean;
}

export interface SourceJobs {
  source: UserSource;
  jobs: SourceJob[];
}

export interface SavedSourceJob {
  opportunityId: string;
}

export interface NewUserSource {
  url: string;
  name?: string;
  note?: string;
}

export interface QuestionGroup {
  key: string;
  topic: AnswerTopic;
  question: string;
  count: number;
  lastAnswer: string;
  lastSource?: AnswerSource;
  savedAnswerId?: string;
  needsAnswer: boolean;
}

export interface QuestionBank {
  saved: SavedAnswer[];
  groups: QuestionGroup[];
}

export interface TopicKeywords {
  topic: AnswerTopic;
  keywords: string[];
}

export interface AnswerSettings {
  questionMaxLength: number;
  maxSavedAnswers: number;
  topicKeywords: TopicKeywords[];
}

export interface MemberCard {
  id: string;
  name: string;
  headline: string;
  photoUrl?: string;
}

export interface AttachmentView {
  url: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  durationSeconds?: number;
}

export interface MessageView {
  id: string;
  conversationId: string;
  kind: MessageKind;
  text: string;
  attachment?: AttachmentView;
  fromMe: boolean;
  senderName: string;
  createdAt: IsoDateTime;
  state?: MessageState;
}

export interface ConversationSummary {
  id: string;
  kind: ConversationKind;
  title: string;
  photoUrl?: string;
  otherMemberId?: string;
  lastMessageAt?: IsoDateTime;
  lastMessagePreview: string;
  lastMessageKind?: MessageKind;
  lastFromMe: boolean;
  lastState?: MessageState;
  unreadCount: number;
  muted: boolean;
  blocked: boolean;
}

export interface MessagePage {
  conversation: ConversationSummary;
  messages: MessageView[];
  hasMore: boolean;
}

export interface AppNotification {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  target: NotificationTarget;
  targetId: string;
  createdAt: IsoDateTime;
  read: boolean;
}

export interface Inbox {
  unreadMessages: number;
  unreadNotifications: number;
  latest: AppNotification[];
}

export interface NewAttachment {
  kind: MessageKind;
  file: UploadSource;
  text?: string;
  durationSeconds?: number;
}

export interface PushDeviceRegistration {
  token: string;
  platform: DevicePlatform;
}
