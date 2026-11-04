import type { DraftKind, ReplyOutcome, UserAction } from '@careerpilot/domain-ui-logic';
import type {
  AcademicOverview,
  AcademicReference,
  Credential,
  CredentialInput,
  Exam,
  ExamInput,
  MessageDraft,
  OfferRow,
  Outreach,
  OutreachDraftInput,
  OutreachInput,
  OutreachSettings,
  Plan,
  Program,
  ProgramInput,
  Recommendation,
  RecommendationInput,
  RecommendationStatusChange,
  Referee,
  RefereeInput,
} from './types';

export interface AcademicApi {
  reference(): Promise<AcademicReference>;
  overview(): Promise<AcademicOverview>;
  getSettings(): Promise<OutreachSettings>;
  updateSettings(settings: OutreachSettings): Promise<OutreachSettings>;
  listPrograms(): Promise<Program[]>;
  getProgram(id: string): Promise<Program>;
  createProgram(input: ProgramInput): Promise<Program>;
  createProgramFromOpportunity(opportunityId: string): Promise<Program>;
  updateProgram(id: string, input: ProgramInput): Promise<Program>;
  removeProgram(id: string): Promise<void>;
  plan(id: string): Promise<Plan>;
  recordAction(id: string, action: UserAction, confirmed: boolean): Promise<Program>;
  decisionMessage(id: string, action: UserAction): Promise<MessageDraft>;
  generateChecklist(id: string): Promise<Program>;
  compareOffers(ids?: string[]): Promise<OfferRow[]>;
  listExams(): Promise<Exam[]>;
  createExam(input: ExamInput): Promise<Exam>;
  updateExam(id: string, input: ExamInput): Promise<Exam>;
  removeExam(id: string): Promise<void>;
  listCredentials(): Promise<Credential[]>;
  createCredential(input: CredentialInput): Promise<Credential>;
  updateCredential(id: string, input: CredentialInput): Promise<Credential>;
  removeCredential(id: string): Promise<void>;
  listReferees(): Promise<Referee[]>;
  createReferee(input: RefereeInput): Promise<Referee>;
  updateReferee(id: string, input: RefereeInput): Promise<Referee>;
  setRefereeConsent(id: string, confirmed: boolean): Promise<Referee>;
  removeReferee(id: string): Promise<void>;
  listRecommendations(programId?: string): Promise<Recommendation[]>;
  createRecommendation(input: RecommendationInput): Promise<Recommendation>;
  updateRecommendation(id: string, input: RecommendationInput): Promise<Recommendation>;
  setRecommendationStatus(id: string, change: RecommendationStatusChange): Promise<Recommendation>;
  recommendationDraft(id: string, kind: DraftKind): Promise<MessageDraft>;
  removeRecommendation(id: string): Promise<void>;
  listOutreach(): Promise<Outreach[]>;
  draftOutreach(input: OutreachDraftInput): Promise<Outreach>;
  updateOutreach(id: string, input: OutreachInput): Promise<Outreach>;
  markOutreachSent(id: string, on?: string): Promise<Outreach>;
  recordOutreachReply(id: string, outcome: ReplyOutcome, note?: string): Promise<Outreach>;
  removeOutreach(id: string): Promise<void>;
}
