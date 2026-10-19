import type { OpportunityDecision } from '@careerpilot/domain-ui-logic';
import type {
  ApplicationFilter,
  ApplicationRecord,
  ApplicationSummary,
  ApprovalDetail,
  ApprovalSummary,
  DashboardSummary,
  DeletionRequest,
  OpportunityDetail,
  PauseOption,
  Profile,
  PublicConfig,
  RegisterRequest,
  Session,
  Settings,
  SignInEvent,
  SignInRequest,
  SubmissionWindow,
  Track,
  TrackUpdate,
} from './types';

export interface AuthApi {
  signIn(request: SignInRequest): Promise<Session>;
  register(request: RegisterRequest): Promise<Session>;
  requestPasswordReset(email: string): Promise<void>;
  signOut(): Promise<void>;
}

export interface ConfigApi {
  getPublicConfig(): Promise<PublicConfig>;
}

export interface DashboardApi {
  getDashboard(): Promise<DashboardSummary>;
}

export interface OpportunityApi {
  getOpportunity(id: string): Promise<OpportunityDetail>;
  decide(id: string, decision: OpportunityDecision): Promise<void>;
  prepareApplication(id: string): Promise<ApprovalSummary>;
}

export interface ApprovalApi {
  listApprovals(): Promise<ApprovalSummary[]>;
  getApproval(id: string): Promise<ApprovalDetail>;
  updateAnswer(approvalId: string, answerId: string, answer: string): Promise<ApprovalDetail>;
  approve(id: string): Promise<ApprovalDetail>;
  reject(id: string): Promise<ApprovalDetail>;
}

export interface ApplicationApi {
  listApplications(filter: ApplicationFilter): Promise<ApplicationSummary[]>;
  getApplication(id: string): Promise<ApplicationRecord>;
}

export interface ProfileApi {
  getProfile(): Promise<Profile>;
  reorderContacts(orderedIds: string[]): Promise<Profile>;
  setPrimaryContact(id: string): Promise<Profile>;
}

export interface SettingsApi {
  getSettings(): Promise<Settings>;
  updateTrack(id: string, update: TrackUpdate): Promise<Track>;
  pause(option: PauseOption): Promise<Settings>;
  resume(): Promise<Settings>;
  updateSubmissionWindow(window: SubmissionWindow): Promise<Settings>;
  listSignInActivity(): Promise<SignInEvent[]>;
  requestAccountDeletion(): Promise<DeletionRequest>;
}

export interface CareerPilotApi {
  auth: AuthApi;
  config: ConfigApi;
  dashboard: DashboardApi;
  opportunities: OpportunityApi;
  approvals: ApprovalApi;
  applications: ApplicationApi;
  profile: ProfileApi;
  settings: SettingsApi;
}

export interface Clock {
  now(): Date;
}

export interface IdGenerator {
  next(prefix: string): string;
}

export const systemClock: Clock = { now: () => new Date() };

export function sequentialIds(): IdGenerator {
  let counter = 0;
  return {
    next: (prefix) => {
      counter += 1;
      return `${prefix}_${counter}`;
    },
  };
}
