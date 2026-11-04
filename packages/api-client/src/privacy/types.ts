import type {
  ConsentKind,
  DeletionScope,
  DeletionStatus,
  ExportFormat,
  ExportKind,
  ExportStatus,
  ExternalData,
  OutcomeStatus,
  ReportBucket,
  ReportPeriod,
  RetainedRecord,
  SubmissionStatus,
  TaskKind,
} from '@careerpilot/domain-ui-logic';

export interface BucketCount {
  bucket: ReportBucket;
  count: number;
}

export interface LabelCount {
  label: string;
  count: number;
}

export interface StatusCount {
  status: SubmissionStatus;
  count: number;
}

export interface ReportRow {
  applicationId: string;
  title: string;
  organization: string;
  track: string;
  route: string;
  submissionStatus: SubmissionStatus;
  outcomeStatus: OutcomeStatus;
  bucket: ReportBucket;
  appliedAt?: string;
  updatedAt: string;
}

export interface ReportUpcoming {
  applicationId: string;
  organization: string;
  title: string;
  kind: TaskKind;
  taskTitle: string;
  dueAt: string;
}

export interface ActivityReport {
  period: ReportPeriod;
  startDate: string;
  endDate: string;
  timeZone: string;
  buckets: BucketCount[];
  total: number;
  responses: number;
  byStatus: StatusCount[];
  byTrack: LabelCount[];
  byRoute: LabelCount[];
  rows: ReportRow[];
  upcoming: ReportUpcoming[];
}

export interface ExportInput {
  kind: ExportKind;
  format: ExportFormat;
  period?: ReportPeriod;
  date?: string;
  applicationId?: string;
  password?: string;
}

export interface ExportView {
  id: string;
  kind: ExportKind;
  format: ExportFormat;
  status: ExportStatus;
  requestedAt: string;
  period?: ReportPeriod;
  date?: string;
  applicationId?: string;
  completedAt?: string;
  expiresAt?: string;
  fileName?: string;
  sizeBytes?: number;
  downloadUrl?: string;
  failure?: string;
}

export interface RetainedItem {
  record: RetainedRecord;
  retentionDays: number;
  reason: string;
}

export interface DeletionPlan {
  graceDays: number;
  erased: DeletionScope[];
  retained: RetainedItem[];
  external: ExternalData[];
}

export interface DeletionView {
  status?: DeletionStatus;
  requestedAt?: string;
  scheduledFor?: string;
  plan: DeletionPlan;
}

export interface ConsentEntry {
  kind: ConsentKind;
  required: boolean;
  granted: boolean;
  version?: string;
  at?: string;
}

export interface ConsentRecord {
  id: string;
  kind: ConsentKind;
  granted: boolean;
  version: string;
  at: string;
  ip: string;
  device: string;
}

export interface ConsentOverview {
  current: ConsentEntry[];
  history: ConsentRecord[];
}

export interface AdminExportView {
  id: string;
  userId: string;
  kind: ExportKind;
  format: ExportFormat;
  status: ExportStatus;
  requestedAt: string;
  completedAt?: string;
  expiresAt?: string;
  sizeBytes?: number;
}

export interface AdminDeletionView {
  id: string;
  userId: string;
  status: DeletionStatus;
  requestedAt: string;
  scheduledFor: string;
  cancelledAt?: string;
  completedAt?: string;
}
