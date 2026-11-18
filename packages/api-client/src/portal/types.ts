import type {
  AttemptState,
  FieldSource,
  FieldStatus,
  HostPolicy,
  PortalAccountOrigin,
  PortalAccountStatus,
  ReadinessState,
  StopReason,
  Verdict,
  WallKind,
} from '@careerpilot/domain-ui-logic';

export interface PortalPermissions {
  allowAccountCreation: boolean;
  accountEmail?: string;
  acceptTerms: boolean;
  acceptPrivacy: boolean;
  allowEmailVerification: boolean;
}

export interface PortalSettings {
  enabled: boolean;
  enabledAt?: string;
  summaryVersion: number;
  permissions: PortalPermissions;
}

export interface AutopilotSummary {
  summaryVersion: number;
  userOnlySteps: string[];
  routes: string[];
  ruleNames: string[];
  documentNames: string[];
  live: boolean;
  mailConnected: boolean;
}

export interface AutopilotState {
  settings: PortalSettings;
  summary: AutopilotSummary;
}

export interface AutopilotInput extends PortalPermissions {
  acknowledged: boolean;
}

export interface PortalAccountView {
  id: string;
  host: string;
  employer: string;
  email: string;
  status: PortalAccountStatus;
  origin: PortalAccountOrigin;
  siteUrl: string;
  createdAt: string;
  lastUsedAt?: string;
}

export interface PortalAccountSecret {
  id: string;
  host: string;
  email: string;
  password: string;
}

export interface PortalAccountInput {
  host: string;
  employer?: string;
  email: string;
  password: string;
  siteUrl?: string;
}

export interface PreparedAnswer {
  label: string;
  value: string;
  source?: FieldSource;
}

export interface PendingQuestion {
  label: string;
  reason: StopReason;
  options: string[];
}

export interface AttemptView {
  applicationId: string;
  state: AttemptState;
  stop?: StopReason;
  detail: string;
  officialUrl: string;
  host: string;
  prepared: PreparedAnswer[];
  pending: PendingQuestion[];
  submitClicked: boolean;
  runs: number;
  finalUrl: string;
  confirmationText: string;
  evidenceKey: string;
  updatedAt: string;
}

export interface ResumeAnswer {
  label: string;
  answer: string;
}

export interface ResumeInput {
  answers: ResumeAnswer[];
}

export interface PortalHostRecord {
  host: string;
  policy: HostPolicy;
  note: string;
  configured: boolean;
  decidedAt?: string;
}

export interface PortalHostInput {
  policy: HostPolicy;
  note?: string;
}

export interface FieldPlan {
  handle: string;
  label: string;
  kind: string;
  required: boolean;
  source?: FieldSource;
  status: FieldStatus;
  value: string;
  stop?: StopReason;
}

export interface ReadinessReport {
  id: string;
  url: string;
  host: string;
  state: ReadinessState;
  requestedAt: string;
  requestedBy: string;
  finishedAt?: string;
  hostPolicy?: HostPolicy;
  wall: WallKind;
  captchaSeen: boolean;
  pageTitle: string;
  finalUrl: string;
  fields: FieldPlan[];
  mapped: number;
  unknown: number;
  verdict?: Verdict;
  reasons: StopReason[];
  error: string;
}

export interface FillFact {
  fact: string;
  value: string;
  autocomplete: string[];
  names: string[];
  labels: string[];
}

export interface FillAnswer {
  label: string;
  answer: string;
}

export interface FillCv {
  name: string;
  url: string;
}

export interface FillPlan {
  applicationId: string;
  officialUrl: string;
  host: string;
  hostPolicy: HostPolicy;
  assistAllowed: boolean;
  accountEmail: string;
  hasPassword: boolean;
  facts: FillFact[];
  answers: FillAnswer[];
  coverLetter: string;
  coverLetterLabels: string[];
  resumeLabels: string[];
  cv?: FillCv;
  confirmationPhrases: string[];
  skipTerms: string[];
  captchaSelectors: string[];
}

export interface FillPassword {
  email: string;
  password: string;
}

export interface EvidenceLink {
  url: string;
}

export interface CompleteInput {
  finalUrl?: string;
  confirmationText?: string;
}
