import type {
  AgreementStatus,
  AmountSource,
  AttentionKind,
  BudgetKind,
  ChecklistStep,
  ConversionSource,
  CredentialKind,
  CredentialNeed,
  DeadlineKind,
  DecisionKind,
  EvidenceStatus,
  ExamKind,
  ExamStatus,
  FundingStatus,
  GradeScale,
  IntakeTerm,
  ItemProgress,
  NeedLevel,
  OutreachStatus,
  PlanStepKind,
  PortalBlocker,
  PortalFee,
  PortalSubmission,
  ProgramStatus,
  ReceiptEvidence,
  RecommendationStatus,
  ScorePolicy,
  StudyKind,
  SubmissionMethod,
  UserAction,
  WarningKind,
} from "@careerpilot/domain-ui-logic";

export type IsoDay = string;

export interface Deadline {
  kind: DeadlineKind;
  on: IsoDay;
  note: string;
  sourceUrl: string;
}

export interface StudyExamRequirement {
  exam: ExamKind;
  need: NeedLevel;
  evidence: EvidenceStatus;
  minOverall?: number;
  sectionMinimums: Record<string, number>;
  policy: ScorePolicy;
  policyEvidence: EvidenceStatus;
  waiverDescribed: boolean;
  note: string;
}

export interface GradeRequirement {
  scale: GradeScale;
  minimum: string;
  evidence: EvidenceStatus;
}

export interface CredentialRequirement {
  need: CredentialNeed;
  evidence: EvidenceStatus;
  cost?: number;
  days?: number;
  status: ItemProgress;
  credentialId?: string;
  note: string;
}

export interface Statement {
  evidence: EvidenceStatus;
  note: string;
}

export interface Funding {
  status: FundingStatus;
  tuitionPerYear?: number;
  livingCostPerYear?: number;
  fundingPerYear?: number;
  durationMonths?: number;
  currency: string;
  conditions: string;
}

export interface FeeInfo {
  amount?: number;
  currency: string;
  source: AmountSource;
  waiverNote: string;
  waiverConditions: string;
}

export interface WorkInfo {
  note: string;
  sourceUrl: string;
  checkedOn?: IsoDay;
}

export interface BudgetItem {
  id: string;
  kind: BudgetKind;
  amount: number;
  currency: string;
  source: AmountSource;
  note: string;
}

export interface PortalSection {
  name: string;
  done: boolean;
}

export interface PortalDocument {
  name: string;
  uploaded: boolean;
}

export interface PortalInvite {
  refereeId: string;
  authorizedOn?: IsoDay;
  invitedOn?: IsoDay;
}

export interface PendingItem {
  id: string;
  name: string;
  received: boolean;
}

export interface PortalApplication {
  accountLabel: string;
  sections: PortalSection[];
  documents: PortalDocument[];
  invites: PortalInvite[];
  fee: PortalFee;
  feeEvidence: string;
  submission: PortalSubmission;
  submittedOn?: IsoDay;
  privacyNoticeUrl: string;
  pendingItems: PendingItem[];
}

export interface Condition {
  id: string;
  text: string;
  due?: IsoDay;
  met: boolean;
}

export interface ActionRecord {
  action: UserAction;
  confirmedOn: IsoDay;
}

export interface Decision {
  kind: DecisionKind;
  decidedOn?: IsoDay;
  conditions: Condition[];
  acceptanceDeadline?: IsoDay;
  depositAmount?: number;
  depositCurrency: string;
  depositDeadline?: IsoDay;
  deferralNote: string;
  scholarshipNote: string;
  actions: ActionRecord[];
}

export interface ChecklistItem {
  id: string;
  step: ChecklistStep;
  status: ItemProgress;
  dueOn?: IsoDay;
  sourceUrl: string;
  sourceCheckedOn?: IsoDay;
  note: string;
}

export interface ProgramInput {
  kind: StudyKind;
  title: string;
  university: string;
  department: string;
  degree: string;
  field: string;
  countryCode: string;
  campus: string;
  supervisor: string;
  researchArea: string;
  term?: IntakeTerm;
  year?: number;
  startsOn?: IsoDay;
  durationMonths?: number;
  studyMode: string;
  sourceUrl: string;
  portalUrl: string;
  notes: string;
  status: ProgramStatus;
  opportunityId?: string;
  linkedProgramIds: string[];
  deadlines: Deadline[];
  examRequirements: StudyExamRequirement[];
  minGrade?: GradeRequirement;
  credentialRequirements: CredentialRequirement[];
  equivalence: Statement;
  refereesRequired?: number;
  funding: Funding;
  fee: FeeInfo;
  workInfo: WorkInfo;
  budget: BudgetItem[];
  portal: PortalApplication;
  decision?: Decision;
  checklist: ChecklistItem[];
}

export interface Program extends ProgramInput {
  id: string;
}

export interface Scores {
  overall?: number;
  sections: Record<string, number>;
}

export interface ScoreReport {
  id: string;
  programId: string;
  institutionCode: string;
  sentOn?: IsoDay;
  feeAmount?: number;
  feeCurrency: string;
  confirmedReceipt: boolean;
  confirmedOn?: IsoDay;
}

export interface ExamInput {
  exam: ExamKind;
  status: ExamStatus;
  registrationDeadline?: IsoDay;
  testOn?: IsoDay;
  scoreReleaseOn?: IsoDay;
  scores?: Scores;
  validityMonths?: number;
  feeAmount?: number;
  feeCurrency: string;
  feeSource: AmountSource;
  reports: ScoreReport[];
  note: string;
}

export interface Exam extends ExamInput {
  id: string;
  expiresOn?: IsoDay;
}

export interface CredentialInput {
  kind: CredentialKind;
  institution: string;
  title: string;
  scale: GradeScale;
  value: string;
  outOf: string;
  graduatedYear?: number;
  convertedValue: string;
  conversionSource?: ConversionSource;
  documentName: string;
  note: string;
}

export interface Credential extends CredentialInput {
  id: string;
  conversionIsEstimate: boolean;
}

export interface RefereeInput {
  name: string;
  email: string;
  phone: string;
  title: string;
  institution: string;
  relationship: string;
}

export interface Referee extends RefereeInput {
  id: string;
  consentConfirmedOn?: IsoDay;
}

export interface RecommendationInput {
  refereeId: string;
  programId: string;
  requestedOn?: IsoDay;
  agreement: AgreementStatus;
  method: SubmissionMethod;
  refereeDeadline?: IsoDay;
  inviteAuthorized: boolean;
  remindersSent: IsoDay[];
  note: string;
}

export interface Recommendation extends RecommendationInput {
  id: string;
  status: RecommendationStatus;
  evidence?: ReceiptEvidence;
  evidenceNote: string;
  evidenceOn?: IsoDay;
}

export interface RecommendationStatusChange {
  status: RecommendationStatus;
  evidence?: ReceiptEvidence;
  evidenceNote?: string;
  on?: IsoDay;
}

export interface MessageDraft {
  subject: string;
  body: string;
}

export interface OutreachDraftInput {
  programId?: string;
  supervisorName: string;
  supervisorEmail: string;
  university: string;
  department: string;
  researchReference: string;
  sourceUrl: string;
}

export interface OutreachInput extends OutreachDraftInput {
  subject: string;
  body: string;
  allowFollowUp: boolean;
}

export interface Outreach extends OutreachInput {
  id: string;
  status: OutreachStatus;
  draftedOn: IsoDay;
  sentOn?: IsoDay;
  lastSentOn?: IsoDay;
  followUpsSent: number;
  repliedOn?: IsoDay;
  replyNote: string;
  doNotContact: boolean;
}

export interface OutreachSettings {
  maxPerDay?: number;
  maxPerDepartment?: number;
  maxPerUniversity?: number;
  followUpsAllowed?: boolean;
}

export interface AcademicWarning {
  kind: WarningKind;
  programId: string;
  exam?: ExamKind;
  on?: IsoDay;
}

export interface PlanStep {
  kind: PlanStepKind;
  on: IsoDay;
  deadlineKind: DeadlineKind;
  label: string;
}

export interface CurrencyTotal {
  currency: string;
  official: number;
  estimate: number;
  total: number;
}

export interface Plan {
  programId: string;
  steps: PlanStep[];
  warnings: AcademicWarning[];
  budget: CurrencyTotal[];
  blockers: PortalBlocker[];
}

export interface AttentionItem {
  kind: AttentionKind;
  programId?: string;
  recordId?: string;
  on?: IsoDay;
}

export interface UpcomingDeadline {
  programId?: string;
  kind: DeadlineKind;
  on: IsoDay;
}

export interface AcademicOverview {
  programs: number;
  attention: AttentionItem[];
  upcoming: UpcomingDeadline[];
  warnings: AcademicWarning[];
}

export interface OfferValue {
  amount?: number;
  estimated: boolean;
}

export interface OfferRow {
  programId: string;
  title: string;
  university: string;
  countryCode: string;
  decision: DecisionKind;
  durationMonths?: number;
  totalCost: OfferValue;
  fundingTotal: OfferValue;
  netCost: OfferValue;
  currency: string;
}

export interface ExamReference {
  kind: ExamKind;
  sections: string[];
  validityMonths: number;
}

export interface AcademicReference {
  currency: string;
  exams: ExamReference[];
  maxPerDay: number;
  maxPerDepartment: number;
  maxPerUniversity: number;
  followUpsAllowed: boolean;
  checklistSteps: ChecklistStep[];
  maxTextLength: number;
}

export type ActionChoice = UserAction;
