import type { OpportunityDecision, PhotoCrop, TaskStatus } from '@careerpilot/domain-ui-logic';
import type { EntryValue } from '@careerpilot/dynamic-forms';
import type {
  AccountLinkDetails,
  ApplicationFilter,
  ApplicationRecord,
  ApplicationSummary,
  ApprovalDetail,
  ApprovalSummary,
  BasicsChanges,
  CompleteAccountLinkRequest,
  ContactChanges,
  ContactInput,
  DashboardSummary,
  DeletionRequest,
  DocumentChanges,
  DocumentInput,
  NewUserSource,
  SavedSourceJob,
  SourceJobs,
  NotificationPreferences,
  OpportunityDetail,
  OutcomeUpdate,
  PasswordChange,
  PauseOption,
  Profile,
  PublicConfig,
  QuestionBank,
  RegisterRequest,
  SavedAnswerInput,
  Session,
  Settings,
  SignInEvent,
  SignInRequest,
  SubmissionWindow,
  TaskInput,
  Track,
  TrackUpdate,
  UploadSource,
  UserSource,
  VerificationChallenge,
} from './types';

export interface AuthApi {
  signIn(request: SignInRequest): Promise<Session>;
  register(request: RegisterRequest): Promise<void>;
  requestPasswordReset(email: string): Promise<void>;
  inspectAccountLink(token: string): Promise<AccountLinkDetails>;
  completeAccountLink(request: CompleteAccountLinkRequest): Promise<Session>;
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
  addByLink(url: string): Promise<OpportunityDetail>;
}

export interface ApprovalApi {
  listApprovals(): Promise<ApprovalSummary[]>;
  getApproval(id: string): Promise<ApprovalDetail>;
  updateAnswer(approvalId: string, answerId: string, answer: string, saveForReuse?: boolean): Promise<ApprovalDetail>;
  approve(id: string): Promise<ApprovalDetail>;
  reject(id: string): Promise<ApprovalDetail>;
}

export interface ApplicationApi {
  listApplications(filter: ApplicationFilter): Promise<ApplicationSummary[]>;
  getApplication(id: string): Promise<ApplicationRecord>;
  updateOutcome(id: string, update: OutcomeUpdate): Promise<ApplicationRecord>;
  addTask(id: string, input: TaskInput): Promise<ApplicationRecord>;
  editTask(id: string, taskId: string, input: TaskInput): Promise<ApplicationRecord>;
  setTaskStatus(id: string, taskId: string, status: TaskStatus): Promise<ApplicationRecord>;
}

export interface AnswersApi {
  getQuestionBank(): Promise<QuestionBank>;
  addAnswer(input: SavedAnswerInput): Promise<QuestionBank>;
  editAnswer(id: string, input: SavedAnswerInput): Promise<QuestionBank>;
  removeAnswer(id: string): Promise<QuestionBank>;
  restoreAnswer(id: string): Promise<QuestionBank>;
}

export interface SourcesApi {
  listSources(): Promise<UserSource[]>;
  addSource(input: NewUserSource): Promise<UserSource>;
  removeSource(id: string): Promise<void>;
  listJobs(id: string): Promise<SourceJobs>;
  saveJob(id: string, jobId: string): Promise<SavedSourceJob>;
}

export interface ProfileApi {
  getProfile(): Promise<Profile>;
  updateBasics(changes: BasicsChanges): Promise<Profile>;
  setPhoto(file: UploadSource): Promise<Profile>;
  setPhotoCrop(crop: PhotoCrop): Promise<Profile>;
  sendContactCode(contactId: string): Promise<VerificationChallenge>;
  confirmContactCode(contactId: string, code: string): Promise<Profile>;
  removePhoto(): Promise<Profile>;
  addContact(input: ContactInput): Promise<Profile>;
  updateContact(id: string, changes: ContactChanges): Promise<Profile>;
  removeContact(id: string): Promise<Profile>;
  restoreContact(id: string): Promise<Profile>;
  reorderContacts(orderedIds: string[]): Promise<Profile>;
  setPrimaryContact(id: string): Promise<Profile>;
  setSkills(skills: string[]): Promise<Profile>;
  addEntry(section: string, values: Record<string, EntryValue>): Promise<Profile>;
  updateEntry(section: string, id: string, values: Record<string, EntryValue>): Promise<Profile>;
  removeEntry(section: string, id: string): Promise<Profile>;
  restoreEntry(section: string, id: string): Promise<Profile>;
  reorderEntries(section: string, orderedIds: string[]): Promise<Profile>;
  uploadDocument(input: DocumentInput): Promise<Profile>;
  uploadDocumentVersion(id: string, file: UploadSource): Promise<Profile>;
  updateDocument(id: string, changes: DocumentChanges): Promise<Profile>;
  removeDocument(id: string): Promise<Profile>;
  restoreDocument(id: string): Promise<Profile>;
  reorderDocuments(orderedIds: string[]): Promise<Profile>;
}

export interface SettingsApi {
  getSettings(): Promise<Settings>;
  updateTrack(id: string, update: TrackUpdate): Promise<Track>;
  pause(option: PauseOption): Promise<Settings>;
  resume(): Promise<Settings>;
  updateSubmissionWindow(window: SubmissionWindow): Promise<Settings>;
  updateExcludedCountries(countries: string[]): Promise<Settings>;
  updateFavoriteCompanies(companies: string[]): Promise<Settings>;
  listSignInActivity(): Promise<SignInEvent[]>;
  requestAccountDeletion(): Promise<DeletionRequest>;
  changePassword(change: PasswordChange): Promise<void>;
  updateNotifications(changes: Partial<NotificationPreferences>): Promise<Settings>;
}

export interface CareerPilotApi {
  auth: AuthApi;
  config: ConfigApi;
  dashboard: DashboardApi;
  opportunities: OpportunityApi;
  approvals: ApprovalApi;
  applications: ApplicationApi;
  answers: AnswersApi;
  sources: SourcesApi;
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
