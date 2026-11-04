import type { ConsentKind, ReportPeriod } from '@careerpilot/domain-ui-logic';
import type { ActivityReport, AdminDeletionView, AdminExportView, ConsentOverview, DeletionView, ExportInput, ExportView } from './types';

export interface AdminPrivacyApi {
  exports(): Promise<AdminExportView[]>;
  deletions(): Promise<AdminDeletionView[]>;
  userConsents(userId: string): Promise<ConsentOverview>;
}

export interface PrivacyApi {
  report(period: ReportPeriod, date?: string): Promise<ActivityReport>;
  requestExport(input: ExportInput): Promise<ExportView>;
  listExports(): Promise<ExportView[]>;
  getExport(id: string): Promise<ExportView>;
  deletion(): Promise<DeletionView>;
  requestDeletion(password: string): Promise<DeletionView>;
  cancelDeletion(): Promise<DeletionView>;
  consents(): Promise<ConsentOverview>;
  updateConsent(kind: ConsentKind, granted: boolean): Promise<ConsentOverview>;
}
