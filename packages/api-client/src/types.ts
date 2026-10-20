import type {
  ApplicationMode,
  ApplicationRoute,
  ApprovalState,
  ContactKind,
  EnumValueMetadata,
  Money,
  MoneyRange,
  OpportunityDecision,
  OpportunityType,
  OutcomeStatus,
  PauseDuration,
  PauseScope,
  RequirementCheck,
  SponsorshipEvidence,
  SubmissionStatus,
  SubmissionWindowKind,
  TimelineActor,
  TrackKind,
  WorkArrangement,
} from '@careerpilot/domain-ui-logic';
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
  password: string;
  consent: boolean;
  consentDocuments: { terms: string; privacy: string };
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
}

export const AnswerSource = {
  Profile: 'profile',
  Ai: 'ai',
  User: 'user',
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
    cv: { name: string; version: number };
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

export interface Education {
  id: string;
  degree: string;
  institution: string;
  startYear: number;
  endYear?: number;
  result?: string;
}

export interface Experience {
  id: string;
  title: string;
  organization: string;
  start: IsoDateTime;
  end?: IsoDateTime;
  summary: string;
}

export interface ProfileDocument {
  id: string;
  name: string;
  version: number;
  updatedAt: IsoDateTime;
}

export interface Profile {
  id: string;
  fullName: string;
  headline: string;
  photoUrl?: string;
  signatureUrl?: string;
  completeness: number;
  contacts: Contact[];
  education: Education[];
  experience: Experience[];
  skills: string[];
  documents: ProfileDocument[];
}

export interface SubmissionWindow {
  kind: SubmissionWindowKind;
  start?: string;
  end?: string;
}

export interface Settings {
  tracks: Track[];
  submissionWindow: SubmissionWindow;
  pause?: PauseState;
  timeZone: string;
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
