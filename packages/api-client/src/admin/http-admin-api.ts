import type { HttpClient } from '../http/http-client';
import { HttpMethod, RequestPace } from '../http/http-client';
import type { CareerPilotAdminApi } from './admin-ports';
import type { PageQuery } from './admin-types';

const enc = encodeURIComponent;

function queryString(query: PageQuery): string {
  const params = new URLSearchParams({ page: String(query.page), pageSize: String(query.pageSize) });
  if (query.search) {
    params.set('search', query.search);
  }
  if (query.status) {
    params.set('status', query.status);
  }
  return params.toString();
}

export function createHttpAdminApi(http: HttpClient): CareerPilotAdminApi {
  const get = <T>(path: string) => http.request<T>(HttpMethod.Get, path);
  const post = <T>(path: string, body?: unknown) => http.request<T>(HttpMethod.Post, path, body ?? {});
  const postLong = <T>(path: string, body: unknown) => http.request<T>(HttpMethod.Post, path, body, RequestPace.Long);
  const patch = <T>(path: string, body: unknown) => http.request<T>(HttpMethod.Patch, path, body);
  const put = <T>(path: string, body: unknown) => http.request<T>(HttpMethod.Put, path, body);

  return {
    auth: {
      signIn: (request) => post('/admin/v1/auth/sign-in', request),
      signOut: () => post('/admin/v1/auth/sign-out'),
      requestPasswordLink: (request) => post('/admin/v1/auth/password-link', request),
      inspectAccountLink: (token) => post('/admin/v1/auth/account-links/inspect', { token }),
      completeAccountLink: (request) => post('/admin/v1/auth/account-links/complete', request),
    },
    dashboard: { getDashboard: () => get('/admin/v1/dashboard') },
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
    },
    opportunities: {
      listOpportunities: (query) => get(`/admin/v1/opportunities?${queryString(query)}`),
      flagOpportunity: (id, reason) => post(`/admin/v1/opportunities/${enc(id)}/flag`, { reason }),
      markExpired: (id) => post(`/admin/v1/opportunities/${enc(id)}/expire`),
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
    },
  };
}
