import type { AdminRole } from '@careerpilot/domain-ui-logic';
import type { SignInRequest } from '../types';
import type {
  AdminAccount,
  AdminApplicationRow,
  AdminDashboard,
  AdminOpportunityRow,
  AdminSession,
  AdminSourceRow,
  AdminUserDetail,
  AdminUserRow,
  AuditEntry,
  EmergencyStopRequest,
  Page,
  PageQuery,
  PlatformSettings,
  PlatformSettingsUpdate,
} from './admin-types';

export interface AdminAuthApi {
  signIn(request: SignInRequest): Promise<AdminSession>;
  signOut(): Promise<void>;
}

export interface AdminDashboardApi {
  getDashboard(): Promise<AdminDashboard>;
}

export interface AdminUsersApi {
  listUsers(query: PageQuery): Promise<Page<AdminUserRow>>;
  getUser(id: string): Promise<AdminUserDetail>;
  suspendUser(id: string, reason: string): Promise<AdminUserDetail>;
  reactivateUser(id: string): Promise<AdminUserDetail>;
  pauseAutomation(id: string): Promise<AdminUserDetail>;
}

export interface AdminOpportunitiesApi {
  listOpportunities(query: PageQuery): Promise<Page<AdminOpportunityRow>>;
  flagOpportunity(id: string, reason: string): Promise<AdminOpportunityRow>;
  markExpired(id: string): Promise<AdminOpportunityRow>;
}

export interface AdminSourcesApi {
  listSources(query: PageQuery): Promise<Page<AdminSourceRow>>;
  setSourceEnabled(id: string, enabled: boolean): Promise<AdminSourceRow>;
  runSourceCheck(id: string): Promise<AdminSourceRow>;
}

export interface AdminApplicationsApi {
  listApplications(query: PageQuery): Promise<Page<AdminApplicationRow>>;
  cancelQueued(id: string, reason: string): Promise<AdminApplicationRow>;
}

export interface AdminSettingsApi {
  getSettings(): Promise<PlatformSettings>;
  updateSettings(update: PlatformSettingsUpdate): Promise<PlatformSettings>;
  startEmergencyStop(request: EmergencyStopRequest): Promise<PlatformSettings>;
  endEmergencyStop(): Promise<PlatformSettings>;
}

export interface AdminAuditApi {
  listAudit(query: PageQuery): Promise<Page<AuditEntry>>;
}

export interface AdminAccountsApi {
  listAdmins(): Promise<AdminAccount[]>;
  setRole(id: string, role: AdminRole): Promise<AdminAccount>;
  setSuspended(id: string, suspended: boolean): Promise<AdminAccount>;
}

export interface CareerPilotAdminApi {
  auth: AdminAuthApi;
  dashboard: AdminDashboardApi;
  users: AdminUsersApi;
  opportunities: AdminOpportunitiesApi;
  sources: AdminSourcesApi;
  applications: AdminApplicationsApi;
  settings: AdminSettingsApi;
  audit: AdminAuditApi;
  admins: AdminAccountsApi;
}
