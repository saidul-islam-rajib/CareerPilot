import type { HttpClient } from '../http/http-client';
import { HttpMethod, RequestPace } from '../http/http-client';
import type { CareerPilotAdminApi } from './admin-ports';
import type { DashboardFilter, PageQuery } from './admin-types';
import { uploadForm } from '../http/http-api';
import { createHttpGovernmentAdmin } from '../government/http';
import { createHttpPortalAdmin } from '../portal/http';
import { createHttpPrivacyAdmin } from '../privacy/http';

const enc = encodeURIComponent;

function queryString(query: PageQuery): string {
  const params = new URLSearchParams({ page: String(query.page), pageSize: String(query.pageSize) });
  if (query.search) {
    params.set('search', query.search);
  }
  if (query.status) {
    params.set('status', query.status);
  }
  if (query.segment) {
    params.set('segment', query.segment);
  }
  return params.toString();
}

function filterString(filter?: DashboardFilter): string {
  const params = new URLSearchParams();
  Object.entries(filter ?? {}).forEach(([key, value]) => {
    if (value) {
      params.set(key, value);
    }
  });
  const text = params.toString();
  return text ? `?${text}` : '';
}

export function createHttpAdminApi(http: HttpClient): CareerPilotAdminApi {
  const get = <T>(path: string) => http.request<T>(HttpMethod.Get, path);
  const post = <T>(path: string, body?: unknown) => http.request<T>(HttpMethod.Post, path, body ?? {});
  const postLong = <T>(path: string, body: unknown) => http.request<T>(HttpMethod.Post, path, body, RequestPace.Long);
  const patch = <T>(path: string, body: unknown) => http.request<T>(HttpMethod.Patch, path, body);
  const remove = (path: string) => http.request<void>(HttpMethod.Delete, path);
  const put = <T>(path: string, body: unknown) => http.request<T>(HttpMethod.Put, path, body);

  return {
    government: createHttpGovernmentAdmin(http),
    portals: createHttpPortalAdmin(http),
    privacy: createHttpPrivacyAdmin(http),
    auth: {
      signIn: (request) => post('/admin/v1/auth/sign-in', request),
      reauthenticate: (request) => post('/admin/v1/auth/reauthenticate', request),
      beginMfaEnrolment: () => post('/admin/v1/auth/mfa/enrol'),
      confirmMfa: (code) => post('/admin/v1/auth/mfa/confirm', { code }),
      regenerateRecoveryCodes: (code) => post('/admin/v1/auth/mfa/recovery-codes', { code }),
      signOut: () => post('/admin/v1/auth/sign-out'),
      requestPasswordLink: (request) => post('/admin/v1/auth/password-link', request),
      inspectAccountLink: (token) => post('/admin/v1/auth/account-links/inspect', { token }),
      completeAccountLink: (request) => post('/admin/v1/auth/account-links/complete', request),
    },
    dashboard: { getDashboard: (filter) => get(`/admin/v1/dashboard${filterString(filter)}`) },
    users: {
      listUsers: (query) => get(`/admin/v1/users?${queryString(query)}`),
      getUser: (id) => get(`/admin/v1/users/${enc(id)}`),
      suspendUser: (id, reason) => post(`/admin/v1/users/${enc(id)}/suspend`, { reason }),
      reactivateUser: (id) => post(`/admin/v1/users/${enc(id)}/reactivate`),
      pauseAutomation: (id) => post(`/admin/v1/users/${enc(id)}/pause-automation`),
      getRecord: (id) => get(`/admin/v1/users/${enc(id)}/record`),
      changeApplication: (id, applicationId, change) => patch(`/admin/v1/users/${enc(id)}/applications/${enc(applicationId)}`, change),
      archiveApplication: (id, applicationId, archived) => post(`/admin/v1/users/${enc(id)}/applications/${enc(applicationId)}/archive`, { archived }),
      setJobDecision: (id, opportunityId, decision) => put(`/admin/v1/users/${enc(id)}/jobs/${enc(opportunityId)}/decision`, { decision }),
      updateTrack: (id, trackId, change) => patch(`/admin/v1/users/${enc(id)}/tracks/${enc(trackId)}`, change),
      resumeAutomation: (id) => post(`/admin/v1/users/${enc(id)}/resume-automation`),
      updateProfile: (id, change) => patch(`/admin/v1/users/${enc(id)}/profile`, change),
      rejectApproval: (id, approvalId) => post(`/admin/v1/users/${enc(id)}/approvals/${enc(approvalId)}/reject`),
      teamMessages: (id) => get(`/admin/v1/users/${enc(id)}/messages`),
      sendTeamMessage: (id, text, replyToId) => post(`/admin/v1/users/${enc(id)}/messages`, { text, replyToId }),
      sendTeamAttachment: (id, attachment) =>
        postLong(`/admin/v1/users/${enc(id)}/attachments`, uploadForm(attachment.file, { kind: attachment.kind, text: attachment.text, replyToId: attachment.replyToId })),
      connections: (id) => get(`/admin/v1/users/${enc(id)}/connections`),
      connectedAccounts: (id) => get(`/admin/v1/users/${enc(id)}/integrations`),
      conversation: (conversationId) => get(`/admin/v1/conversations/${enc(conversationId)}/messages`),
      files: (id) => get(`/admin/v1/users/${enc(id)}/files`),
      overview: (id) => get(`/admin/v1/users/${enc(id)}/overview`),
    },
    messages: {
      inbox: (search) => get(`/admin/v1/messages/inbox?q=${enc(search ?? '')}`),
      unread: () => get('/admin/v1/messages/unread'),
    },
    opportunities: {
      listOpportunities: (query) => get(`/admin/v1/opportunities?${queryString(query)}`),
      flagOpportunity: (id, reason) => post(`/admin/v1/opportunities/${enc(id)}/flag`, { reason }),
      markExpired: (id) => post(`/admin/v1/opportunities/${enc(id)}/expire`),
      listReports: (status) => get(`/admin/v1/opportunity-reports${status ? `?status=${enc(status)}` : ''}`),
      setReportStatus: (id, status) => put(`/admin/v1/opportunity-reports/${enc(id)}/status`, { status }),
    },
    sources: {
      listSources: (query) => get(`/admin/v1/sources?${queryString(query)}`),
      suggestedSources: () => get('/admin/v1/sources/suggestions'),
      addSource: (source) => postLong('/admin/v1/sources', source),
      setSourceEnabled: (id, enabled) => patch(`/admin/v1/sources/${enc(id)}`, { enabled }),
      runSourceCheck: (id) => post(`/admin/v1/sources/${enc(id)}/check`),
      sourceRequests: () => get('/admin/v1/sources/requests'),
      reviewSource: (id, decision) => post(`/admin/v1/sources/${enc(id)}/review`, decision),
    },
    applications: {
      listApplications: (query) => get(`/admin/v1/applications?${queryString(query)}`),
      cancelQueued: (id, reason) => post(`/admin/v1/applications/${enc(id)}/cancel`, { reason }),
    },
    settings: {
      getSettings: () => get('/admin/v1/settings'),
      updateSettings: (update) => patch('/admin/v1/settings', update),
      startEmergencyStop: (request) => post('/admin/v1/emergency-stop', request),
      endEmergencyStop: () => post('/admin/v1/emergency-stop/end'),
    },
    audit: { listAudit: (query) => get(`/admin/v1/audit?${queryString(query)}`) },
    admins: {
      listAdmins: () => get('/admin/v1/admins'),
      setRole: (id, role) => patch(`/admin/v1/admins/${enc(id)}`, { role }),
      setSuspended: (id, suspended) => patch(`/admin/v1/admins/${enc(id)}`, { suspended }),
      createAdmin: (admin) => post('/admin/v1/admins', admin),
      deleteAdmin: (id) => remove(`/admin/v1/admins/${enc(id)}`),
      listRoles: () => get('/admin/v1/roles'),
      createRole: (name, permissions) => post('/admin/v1/roles', { name, permissions }),
      assignRole: (roleId, adminId, assigned) => put(`/admin/v1/roles/${enc(roleId)}/members`, { adminId, assigned }),
      deleteRole: (id) => remove(`/admin/v1/roles/${enc(id)}`),
    },
  };
}
