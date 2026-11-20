import type { AdminRole, OpportunityDecision, ReportStatus } from '@careerpilot/domain-ui-logic';
import type { CompleteAccountLinkRequest, ConnectedAccount, ConversationSummary, MessagePage, MessageView, NewAttachment, OpportunityReport } from '../types';
import type {
  AdminAccount,
  AdminPermission,
  CustomRole,
  DashboardFilter,
  NewAdmin,
  AdminApplicationRow,
  AdminDashboard,
  AdminLinkDetails,
  AdminOpportunityRow,
  AdminSession,
  AdminSignInRequest,
  MfaEnrolment,
  ReauthProof,
  ReauthRequest,
  RecoveryCodes,
  AdminSourceRow,
  AdminApplicationChange,
  AdminUserFiles,
  AdminUserOverview,
  TeamUnread,
  Connection,
  AdminProfileChange,
  AdminTrackChange,
  AdminUserRecord,
  NewSource,
  SourceDecision,
  AdminUserDetail,
  AdminUserRow,
  AuditEntry,
  EmergencyStopRequest,
  Page,
  PageQuery,
  PasswordLinkRequest,
  PlatformSettings,
  PlatformSettingsUpdate,
} from './admin-types';

export interface AdminAuthApi {
  signIn(request: AdminSignInRequest): Promise<AdminSession>;
  reauthenticate(request: ReauthRequest): Promise<ReauthProof>;
  beginMfaEnrolment(): Promise<MfaEnrolment>;
  confirmMfa(code: string): Promise<RecoveryCodes>;
  regenerateRecoveryCodes(code: string): Promise<RecoveryCodes>;
  signOut(): Promise<void>;
  requestPasswordLink(request: PasswordLinkRequest): Promise<void>;
  inspectAccountLink(token: string): Promise<AdminLinkDetails>;
  completeAccountLink(request: CompleteAccountLinkRequest): Promise<AdminSession>;
}

export interface AdminDashboardApi {
  getDashboard(filter?: DashboardFilter): Promise<AdminDashboard>;
}

export interface AdminUsersApi {
  listUsers(query: PageQuery): Promise<Page<AdminUserRow>>;
  getUser(id: string): Promise<AdminUserDetail>;
  suspendUser(id: string, reason: string): Promise<AdminUserDetail>;
  reactivateUser(id: string): Promise<AdminUserDetail>;
  pauseAutomation(id: string): Promise<AdminUserDetail>;
  getRecord(id: string): Promise<AdminUserRecord>;
  changeApplication(id: string, applicationId: string, change: AdminApplicationChange): Promise<AdminUserRecord>;
  archiveApplication(id: string, applicationId: string, archived: boolean): Promise<AdminUserRecord>;
  setJobDecision(id: string, opportunityId: string, decision: OpportunityDecision | null): Promise<AdminUserRecord>;
  updateTrack(id: string, trackId: string, change: AdminTrackChange): Promise<AdminUserRecord>;
  resumeAutomation(id: string): Promise<AdminUserRecord>;
  updateProfile(id: string, change: AdminProfileChange): Promise<AdminUserRecord>;
  rejectApproval(id: string, approvalId: string): Promise<AdminUserRecord>;
  teamMessages(id: string): Promise<MessagePage>;
  sendTeamMessage(id: string, text: string, replyToId?: string): Promise<MessageView>;
  sendTeamAttachment(id: string, attachment: NewAttachment): Promise<MessageView>;
  connections(id: string): Promise<Connection[]>;
  connectedAccounts(id: string): Promise<ConnectedAccount[]>;
  conversation(conversationId: string): Promise<MessagePage>;
  files(id: string): Promise<AdminUserFiles>;
  overview(id: string): Promise<AdminUserOverview>;
}

export interface AdminMessagesApi {
  inbox(search?: string): Promise<ConversationSummary[]>;
  unread(): Promise<TeamUnread>;
}

export interface AdminOpportunitiesApi {
  listOpportunities(query: PageQuery): Promise<Page<AdminOpportunityRow>>;
  flagOpportunity(id: string, reason: string): Promise<AdminOpportunityRow>;
  markExpired(id: string): Promise<AdminOpportunityRow>;
  listReports(status?: ReportStatus): Promise<OpportunityReport[]>;
  setReportStatus(id: string, status: ReportStatus): Promise<OpportunityReport>;
}

export interface AdminSourcesApi {
  listSources(query: PageQuery): Promise<Page<AdminSourceRow>>;
  suggestedSources(): Promise<NewSource[]>;
  addSource(source: NewSource): Promise<AdminSourceRow>;
  setSourceEnabled(id: string, enabled: boolean): Promise<AdminSourceRow>;
  runSourceCheck(id: string): Promise<AdminSourceRow>;
  sourceRequests(): Promise<AdminSourceRow[]>;
  reviewSource(id: string, decision: SourceDecision): Promise<AdminSourceRow>;
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
  createAdmin(admin: NewAdmin): Promise<AdminAccount>;
  deleteAdmin(id: string): Promise<void>;
  listRoles(): Promise<CustomRole[]>;
  createRole(name: string, permissions: AdminPermission[]): Promise<CustomRole>;
  assignRole(roleId: string, adminId: string, assigned: boolean): Promise<CustomRole>;
  deleteRole(id: string): Promise<void>;
}

import type { GovernmentAdminApi } from '../government/ports';
import type { PortalAdminApi } from '../portal/ports';
import type { AdminPrivacyApi } from '../privacy/ports';

export interface CareerPilotAdminApi {
  auth: AdminAuthApi;
  dashboard: AdminDashboardApi;
  users: AdminUsersApi;
  messages: AdminMessagesApi;
  opportunities: AdminOpportunitiesApi;
  sources: AdminSourcesApi;
  applications: AdminApplicationsApi;
  settings: AdminSettingsApi;
  audit: AdminAuditApi;
  admins: AdminAccountsApi;
  government: GovernmentAdminApi;
  portals: PortalAdminApi;
  privacy: AdminPrivacyApi;
}
