import type { ApplicationRecord } from '../types';
import type {
  AttemptView,
  AutopilotInput,
  AutopilotState,
  CompleteInput,
  EvidenceLink,
  FillPassword,
  FillPlan,
  PortalAccountInput,
  PortalAccountSecret,
  PortalAccountView,
  PortalHostInput,
  PortalHostRecord,
  ReadinessReport,
  ResumeInput,
} from './types';

export interface PortalApi {
  autopilot(): Promise<AutopilotState>;
  enableAutopilot(input: AutopilotInput): Promise<AutopilotState>;
  disableAutopilot(): Promise<AutopilotState>;
  listAccounts(): Promise<PortalAccountView[]>;
  addAccount(input: PortalAccountInput): Promise<PortalAccountView>;
  exportAccounts(): Promise<PortalAccountSecret[]>;
  revealAccount(id: string): Promise<PortalAccountSecret>;
  removeAccount(id: string): Promise<void>;
  attempt(applicationId: string): Promise<AttemptView>;
  resume(applicationId: string, input: ResumeInput): Promise<ApplicationRecord>;
  complete(applicationId: string, input?: CompleteInput): Promise<ApplicationRecord>;
  fillPlan(applicationId: string): Promise<FillPlan>;
  fillPassword(applicationId: string): Promise<FillPassword>;
  evidenceLink(applicationId: string): Promise<EvidenceLink>;
  requestReadiness(url: string): Promise<ReadinessReport>;
  readinessReport(reportId: string): Promise<ReadinessReport>;
}

export interface PortalAdminApi {
  listHosts(): Promise<PortalHostRecord[]>;
  decideHost(host: string, input: PortalHostInput): Promise<PortalHostRecord>;
  requestReadiness(url: string): Promise<ReadinessReport>;
  readiness(userId: string, reportId: string): Promise<ReadinessReport>;
}
