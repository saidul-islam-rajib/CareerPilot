import type {
  ActorType,
  ContactKind,
  AdminArea,
  AdminRole,
  ApplicationMode,
  ApplicationRoute,
  EmergencyStopScope,
  OpportunityDecision,
  OpportunityStatus,
  OpportunityType,
  OutcomeStatus,
  PermissionAction,
  ServiceHealth,
  SourceReview,
  SourceStatus,
  SubmissionStatus,
  UserAccountStatus,
  WorkArrangement,
} from '@careerpilot/domain-ui-logic';
import type { ThemeKey } from '@careerpilot/ui-tokens';
import type { ApplicationRecord, ApprovalDetail, IsoDateTime, MemberCard, Profile, Settings, SignInEvent, Track, UserSource } from '../types';

export interface AdminSummary {
  id: string;
  fullName: string;
  email: string;
  role: AdminRole;
}

export interface AdminLinkDetails {
  fullName: string;
  email: string;
}

export interface PasswordLinkRequest {
  email: string;
}

export interface AdminSession {
  accessToken: string;
  admin: AdminSummary;
  permissions: AdminPermission[];
}

export interface AdminPermission {
  area: AdminArea;
  actions: PermissionAction[];
}

export interface PageQuery {
  search?: string;
  status?: string;
  page: number;
  pageSize: number;
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface CountByKey {
  key: string;
  count: number;
}

export interface DailyCount {
  date: string;
  count: number;
}

export interface AdminDashboard {
  generatedAt: IsoDateTime;
  users: {
    total: number;
    newThisWeek: number;
    active: number;
    paused: number;
    suspended: number;
    pendingDeletion: number;
    automaticEnabled: number;
    incompleteProfiles: number;
  };
  applications: {
    total: number;
    bySubmissionStatus: CountByKey[];
    byOutcomeStatus: CountByKey[];
    byMode: CountByKey[];
    approvalsWaiting: number;
    failures: number;
    outcomeUnknown: number;
    perDay: DailyCount[];
  };
  opportunities: { discovered: number; active: number; expired: number; flagged: number; archivedCirculars: number };
  sources: { total: number; healthy: number; degraded: number; failing: number; disabled: number };
  notifications: { sent: number; delivered: number; failed: number };
  health: Array<{ service: string; status: ServiceHealth }>;
  emergencyStop: EmergencyStop;
}

export interface UserPresence {
  online: boolean;
  lastSeenAt?: IsoDateTime;
  activeSeconds: number;
  sessionsCount: number;
  location: string;
  device: string;
}

export interface UserSession {
  id: string;
  userId: string;
  startedAt: IsoDateTime;
  lastSeenAt: IsoDateTime;
  ip: string;
  device: string;
  approximateLocation: string;
  activeSeconds: number;
  signedOutAt?: IsoDateTime;
}

export interface AdminUserRow {
  id: string;
  fullName: string;
  email: string;
  status: UserAccountStatus;
  country: string;
  createdAt: IsoDateTime;
  lastSignInAt?: IsoDateTime;
  applicationsCount: number;
  automaticEnabled: boolean;
  profileCompleteness: number;
  presence: UserPresence;
}

export interface SecretMetadata {
  kind: string;
  label: string;
  createdAt: IsoDateTime;
  lastUsedAt?: IsoDateTime;
}

export interface AdminUserDetail extends AdminUserRow {
  phone?: string;
  tracks: Track[];
  recentApplications: AdminApplicationRow[];
  signIns: SignInEvent[];
  secrets: SecretMetadata[];
}

export interface AdminOpportunityRow {
  id: string;
  title: string;
  organization: string;
  countryCode: string;
  type: OpportunityType;
  status: OpportunityStatus;
  discoveredAt: IsoDateTime;
  applicationsCount: number;
}

export const SourceConnector = {
  Rss: 'rss',
  Greenhouse: 'greenhouse',
  Lever: 'lever',
  Ashby: 'ashby',
  Workable: 'workable',
  SmartRecruiters: 'smartrecruiters',
  EasyJobs: 'easyjobs',
  Html: 'html',
} as const;
export type SourceConnector = (typeof SourceConnector)[keyof typeof SourceConnector];

export interface SourceDefaults {
  type: OpportunityType;
  workArrangement: WorkArrangement;
  countryCode?: string;
  location?: string;
  organization?: string;
}

export interface SourceSetup {
  connector: string;
  url: string;
  siteUrl?: string;
  defaults: SourceDefaults;
}

export interface NewSource {
  url: string;
  name?: string;
  connector?: string;
  defaults?: SourceDefaults;
}

export interface AdminSourceRow {
  id: string;
  name: string;
  status: SourceStatus;
  enabled: boolean;
  lastSuccessAt?: IsoDateTime;
  failuresLast24h: number;
  opportunitiesFound: number;
  setup?: SourceSetup;
  lastCheckedAt?: IsoDateTime;
  lastError?: string;
  review: SourceReview;
  ownerIds: string[];
  requestedAt?: IsoDateTime;
  requestNote?: string;
  reviewedAt?: IsoDateTime;
  reviewNote?: string;
}

export interface SourceDecision {
  review: SourceReview;
  note: string;
}

export interface AdminApplicationRow {
  id: string;
  userName: string;
  opportunityTitle: string;
  organization: string;
  submissionStatus: SubmissionStatus;
  outcomeStatus: OutcomeStatus;
  route: ApplicationRoute;
  mode: ApplicationMode;
  updatedAt: IsoDateTime;
}

export interface EmergencyStop {
  active: boolean;
  scope?: EmergencyStopScope;
  target?: string;
  reason?: string;
  since?: IsoDateTime;
}

export interface PlatformSettings {
  activeTheme: ThemeKey;
  emergencyStop: EmergencyStop;
  dailyApplicationCap: number;
  approvalValidityDays: number;
  deletionGraceDays: number;
  accountLinkTtlMinutes: number;
  maxSourcesPerUser: number;
}

export interface PlatformSettingsUpdate {
  activeTheme?: ThemeKey;
  dailyApplicationCap?: number;
  approvalValidityDays?: number;
  deletionGraceDays?: number;
  accountLinkTtlMinutes?: number;
  maxSourcesPerUser?: number;
}

export interface EmergencyStopRequest {
  scope: EmergencyStopScope;
  target?: string;
  reason: string;
}

export interface AuditEntry {
  id: string;
  at: IsoDateTime;
  actorName: string;
  actorType: ActorType;
  action: string;
  target: string;
}

export interface AdminAccount {
  id: string;
  fullName: string;
  email: string;
  role: AdminRole;
  suspended: boolean;
  mfaEnabled: boolean;
  lastSignInAt?: IsoDateTime;
}

export interface AdminListedJob {
  id: string;
  title: string;
  organization: string;
  location: string;
  countryCode: string;
  matchScore: number;
  decision?: OpportunityDecision;
  applied: boolean;
  sourceName: string;
  url: string;
}

export interface AdminTrackList {
  track: Track;
  jobs: AdminListedJob[];
}

export interface AdminUserRecord {
  user: AdminUserRow;
  profile: Profile;
  preferences: Settings;
  lists: AdminTrackList[];
  approvals: ApprovalDetail[];
  applications: ApplicationRecord[];
  sources: UserSource[];
  signIns: SignInEvent[];
  sessions: UserSession[];
}

export interface AdminApplicationChange {
  submissionStatus?: SubmissionStatus;
  outcomeStatus?: OutcomeStatus;
  note?: string;
}

export interface AdminProfileChange {
  fullName?: string;
  headline?: string;
  location?: string;
  countryCode?: string;
  summary?: string;
}

export interface AdminTrackChange {
  resultCount?: number;
  mode?: ApplicationMode;
}

export interface Connection {
  member: MemberCard;
  conversationId: string;
  connectedAt: IsoDateTime;
  messages: number;
  lastMessageAt?: IsoDateTime;
}

export interface AdminFileLink {
  id: string;
  name: string;
  kind: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  version: number;
  updatedAt: IsoDateTime;
  url: string;
}

export interface AdminContactView {
  kind: ContactKind;
  label: string;
  value: string;
  verified: boolean;
  primary: boolean;
}

export interface AdminUserFiles {
  contacts: AdminContactView[];
  documents: AdminFileLink[];
  photoUrl?: string;
}
