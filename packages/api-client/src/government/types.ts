import { DistrictBasis } from '@careerpilot/domain-ui-logic';
import type {
  BdExam,
  CircularPhase,
  CircularStatus,
  CriterionKind,
  DayKind,
  DeadlineSubject,
  Eligibility,
  EligibilityReason,
  EvidenceSource,
  FeeStatus,
  FeeUrgency,
  GovApplicationStatus,
  GovStage,
  GuideActor,
  GuideStepKind,
  NoticeKind,
  PaymentMethod,
  QuotaKind,
  ResultScale,
  SecretKind,
  SpecialStatus,
  StageStatus,
} from '@careerpilot/domain-ui-logic';

export type IsoDate = string;
export type IsoMoment = string;

export interface AgeRelaxation {
  status: SpecialStatus;
  maxYears: number;
}

export interface AgeRule {
  minYears?: number;
  maxYears?: number;
  relaxations: AgeRelaxation[];
}

export interface ExamRequirement {
  exam: BdExam;
  scale?: ResultScale;
  minResult?: string;
  subjectKeywords: string[];
}

export interface Quota {
  kind: QuotaKind;
  vacancies?: number;
}

export interface GovPost {
  id: string;
  title: string;
  grade?: number;
  payMin?: number;
  payMax?: number;
  vacancies?: number;
  location: string;
  requiresCitizenship: boolean;
  age: AgeRule;
  education: ExamRequirement[];
  quotas: Quota[];
  districts: string[];
  districtBasis: DistrictBasis;
  feeAmount?: number;
}

export interface FeeRule {
  amount?: number;
  method?: PaymentMethod;
  windowHours?: number;
}

export interface CircularNotice {
  id: string;
  kind: NoticeKind;
  title: string;
  url: string;
  publishedOn?: IsoDate;
}

export interface CircularContent {
  authority: string;
  ministry: string;
  title: string;
  sourceName: string;
  sourceUrl: string;
  noticeUrl: string;
  applyUrl: string;
  publishedOn?: IsoDate;
  opensOn?: IsoDate;
  closesOn?: IsoDate;
  closesTime?: string;
  ageCutoffOn?: IsoDate;
  fee?: FeeRule;
  requiredDocuments: string[];
  applicationMethod: string;
  sourceText: string;
  posts: GovPost[];
  notices: CircularNotice[];
}

export interface CircularVersion {
  version: number;
  fingerprint: string;
  capturedAt: IsoMoment;
  changed: string[];
  snapshot: CircularContent;
}

export interface Circular extends CircularContent {
  id: string;
  status: CircularStatus;
  version: number;
  fingerprint: string;
  capturedAt: IsoMoment;
  liveRemoved: boolean;
  versions: CircularVersion[];
}

export interface DeadlineNote {
  subject: DeadlineSubject;
  on: IsoDate;
  kind: DayKind;
  holidayName: string;
  outsideOfficeHours: boolean;
  previousWorkingDay?: IsoDate;
  nextWorkingDay?: IsoDate;
}

export interface Criterion {
  kind: CriterionKind;
  outcome: Eligibility;
  reason: EligibilityReason;
  expected: string;
  found: string;
  exam?: BdExam;
}

export interface QuotaClaim {
  kind: QuotaKind;
  outcome: Eligibility;
  vacancies?: number;
}

export interface PostEligibility {
  postId: string;
  overall: Eligibility;
  criteria: Criterion[];
  quotas: QuotaClaim[];
}

export interface PostSummary {
  id: string;
  title: string;
  grade?: number;
  payMin?: number;
  payMax?: number;
  vacancies?: number;
  location: string;
  eligibility: Eligibility;
}

export interface CircularSummary {
  id: string;
  title: string;
  authority: string;
  closesOn?: IsoDate;
  phase: CircularPhase;
  amended: boolean;
  vacancies: number;
  posts: PostSummary[];
}

export interface CircularView {
  circular: Circular;
  phase: CircularPhase;
  amended: boolean;
  closeNote?: DeadlineNote;
  grades: number[];
  posts: PostEligibility[];
}

export interface CircularFilters {
  grades?: number[];
  gradeMin?: number;
  gradeMax?: number;
  authority?: string;
  location?: string;
  phase?: CircularPhase;
  eligibleOnly?: boolean;
}

export interface FeeRecord {
  amount?: number;
  currency: string;
  status: FeeStatus;
  method?: PaymentMethod;
  paymentDeadline?: IsoMoment;
  evidenceNote: string;
  confirmedAt?: IsoMoment;
}

export interface StageRecord {
  id: string;
  stage: GovStage;
  status: StageStatus;
  on?: IsoDate;
  time?: string;
  venue: string;
  note: string;
  noticeUrl: string;
  source: EvidenceSource;
}

export interface StageInput {
  stage: GovStage;
  status: StageStatus;
  on?: IsoDate;
  time?: string;
  venue?: string;
  note?: string;
  noticeUrl?: string;
  source?: EvidenceSource;
}

export interface ApplicantCopy {
  id: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  uploadedAt: IsoMoment;
  url: string;
}

export interface GovApplication {
  id: string;
  circularId: string;
  circularTitle: string;
  authority: string;
  circularVersion: number;
  postIds: string[];
  postTitles: string[];
  status: GovApplicationStatus;
  submittedAt?: IsoMoment;
  fee: FeeRecord;
  feeUrgency: FeeUrgency;
  feeNote?: DeadlineNote;
  stages: StageRecord[];
  copies: ApplicantCopy[];
  secretsPresent: SecretKind[];
  closesOn?: IsoDate;
  applyUrl: string;
}

export interface FeeChange {
  status?: FeeStatus;
  method?: PaymentMethod;
  paymentDeadline?: IsoMoment;
  evidenceNote?: string;
  transactionId?: string;
}

export type SecretValues = Partial<Record<SecretKind, string>>;

export interface GuideStep {
  kind: GuideStepKind;
  actor: GuideActor;
  done: boolean;
  link: string;
}

export interface UpcomingItem {
  applicationId: string;
  circularTitle: string;
  subject: DeadlineSubject;
  stage?: GovStage;
  on: IsoDate;
  note: DeadlineNote;
}

export interface GradeInfo {
  grade: number;
  payMin: number;
  payMax: number;
}

export interface GovHoliday {
  id: string;
  on: IsoDate;
  name: string;
}

export interface RecurringHoliday {
  month: number;
  day: number;
  name: string;
}

export interface GovReference {
  currency: string;
  timeZone: string;
  grades: GradeInfo[];
  holidays: GovHoliday[];
  recurringHolidays: RecurringHoliday[];
  weekendDays: string[];
  officeStart: string;
  officeEnd: string;
  relaxationSuggestions: AgeRelaxation[];
  defaultMaxAge: number;
  copyTypes: string[];
  copyMaxBytes: number;
}

export interface ConnectorDraft {
  content: CircularContent;
  needsReview: boolean;
}

export function emptyPost(id = ''): GovPost {
  return {
    id,
    title: '',
    location: '',
    requiresCitizenship: true,
    age: { relaxations: [] },
    education: [],
    quotas: [],
    districts: [],
    districtBasis: DistrictBasis.HomeDistrict,
  };
}

export function emptyCircularContent(): CircularContent {
  return {
    authority: '',
    ministry: '',
    title: '',
    sourceName: '',
    sourceUrl: '',
    noticeUrl: '',
    applyUrl: '',
    requiredDocuments: [],
    applicationMethod: '',
    sourceText: '',
    posts: [],
    notices: [],
  };
}
