import type { CareerPilotApi } from '../ports';
import { HttpMethod, type HttpClient } from './http-client';

const enc = encodeURIComponent;

export function createHttpApi(http: HttpClient): CareerPilotApi {
  const get = <T>(path: string) => http.request<T>(HttpMethod.Get, path);
  const post = <T>(path: string, body?: unknown) => http.request<T>(HttpMethod.Post, path, body ?? {});
  const put = <T>(path: string, body: unknown) => http.request<T>(HttpMethod.Put, path, body);
  const patch = <T>(path: string, body: unknown) => http.request<T>(HttpMethod.Patch, path, body);

  return {
    auth: {
      signIn: (request) => post('/v1/auth/sign-in', request),
      register: (request) => post('/v1/auth/register', request),
      requestPasswordReset: (email) => post('/v1/auth/password-reset', { email }),
      signOut: () => post('/v1/auth/sign-out'),
    },
    config: {
      getPublicConfig: () => get('/v1/config'),
    },
    dashboard: {
      getDashboard: () => get('/v1/dashboard'),
    },
    opportunities: {
      getOpportunity: (id) => get(`/v1/opportunities/${enc(id)}`),
      decide: (id, decision) => put(`/v1/opportunities/${enc(id)}/decision`, { decision }),
      prepareApplication: (id) => post(`/v1/opportunities/${enc(id)}/applications`),
    },
    approvals: {
      listApprovals: () => get('/v1/approvals'),
      getApproval: (id) => get(`/v1/approvals/${enc(id)}`),
      updateAnswer: (approvalId, answerId, answer) =>
        put(`/v1/approvals/${enc(approvalId)}/answers/${enc(answerId)}`, { answer }),
      approve: (id) => post(`/v1/approvals/${enc(id)}/approve`),
      reject: (id) => post(`/v1/approvals/${enc(id)}/reject`),
    },
    applications: {
      listApplications: (filter) => get(`/v1/applications?filter=${enc(filter)}`),
      getApplication: (id) => get(`/v1/applications/${enc(id)}`),
    },
    profile: {
      getProfile: () => get('/v1/profile'),
      reorderContacts: (orderedIds) => put('/v1/profile/contacts/order', { orderedIds }),
      setPrimaryContact: (id) => post(`/v1/profile/contacts/${enc(id)}/primary`),
    },
    settings: {
      getSettings: () => get('/v1/settings'),
      updateTrack: (id, update) => patch(`/v1/settings/tracks/${enc(id)}`, update),
      pause: (option) => post('/v1/settings/pause', option),
      resume: () => post('/v1/settings/resume'),
      updateSubmissionWindow: (window) => put('/v1/settings/submission-window', window),
      listSignInActivity: () => get('/v1/account/sign-in-activity'),
      requestAccountDeletion: () => post('/v1/account/deletion'),
    },
  };
}
