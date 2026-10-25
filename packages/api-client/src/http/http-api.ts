import type { CareerPilotApi } from '../ports';
import type { UploadSource } from '../types';
import { HttpMethod, type HttpClient } from './http-client';

const enc = encodeURIComponent;
const FILE_FIELD = 'file';

export function uploadForm(file: UploadSource, fields: Record<string, string | undefined> = {}): FormData {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined) {
      form.append(key, value);
    }
  }
  if (file.blob) {
    form.append(FILE_FIELD, file.blob, file.name);
  } else {
    form.append(FILE_FIELD, { uri: file.uri, name: file.name, type: file.type } as unknown as Blob);
  }
  return form;
}

export function createHttpApi(http: HttpClient): CareerPilotApi {
  const get = <T>(path: string) => http.request<T>(HttpMethod.Get, path);
  const post = <T>(path: string, body?: unknown) => http.request<T>(HttpMethod.Post, path, body ?? {});
  const put = <T>(path: string, body: unknown) => http.request<T>(HttpMethod.Put, path, body);
  const patch = <T>(path: string, body: unknown) => http.request<T>(HttpMethod.Patch, path, body);
  const del = <T>(path: string) => http.request<T>(HttpMethod.Delete, path);
  const section = (key: string) => `/v1/profile/sections/${enc(key)}`;

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
      updateBasics: (changes) => patch('/v1/profile', changes),
      setPhoto: (file) => put('/v1/profile/photo', uploadForm(file)),
      removePhoto: () => del('/v1/profile/photo'),
      addContact: (input) => post('/v1/profile/contacts', input),
      updateContact: (id, changes) => patch(`/v1/profile/contacts/${enc(id)}`, changes),
      removeContact: (id) => del(`/v1/profile/contacts/${enc(id)}`),
      restoreContact: (id) => post(`/v1/profile/contacts/${enc(id)}/restore`),
      reorderContacts: (orderedIds) => put('/v1/profile/contacts/order', { orderedIds }),
      setPrimaryContact: (id) => post(`/v1/profile/contacts/${enc(id)}/primary`),
      setSkills: (skills) => put('/v1/profile/skills', { skills }),
      addEntry: (key, values) => post(section(key), { values }),
      updateEntry: (key, id, values) => patch(`${section(key)}/${enc(id)}`, { values }),
      removeEntry: (key, id) => del(`${section(key)}/${enc(id)}`),
      restoreEntry: (key, id) => post(`${section(key)}/${enc(id)}/restore`),
      reorderEntries: (key, orderedIds) => put(`${section(key)}/order`, { orderedIds }),
      uploadDocument: (input) => post('/v1/profile/documents', uploadForm(input.file, { name: input.name, kind: input.kind })),
      uploadDocumentVersion: (id, file) => post(`/v1/profile/documents/${enc(id)}/versions`, uploadForm(file)),
      updateDocument: (id, changes) => patch(`/v1/profile/documents/${enc(id)}`, changes),
      removeDocument: (id) => del(`/v1/profile/documents/${enc(id)}`),
      restoreDocument: (id) => post(`/v1/profile/documents/${enc(id)}/restore`),
      reorderDocuments: (orderedIds) => put('/v1/profile/documents/order', { orderedIds }),
    },
    settings: {
      getSettings: () => get('/v1/settings'),
      updateTrack: (id, update) => patch(`/v1/settings/tracks/${enc(id)}`, update),
      pause: (option) => post('/v1/settings/pause', option),
      resume: () => post('/v1/settings/resume'),
      updateSubmissionWindow: (window) => put('/v1/settings/submission-window', window),
      listSignInActivity: () => get('/v1/account/sign-in-activity'),
      requestAccountDeletion: () => post('/v1/account/deletion'),
      changePassword: (change) => post('/v1/account/password', change),
      updateNotifications: (changes) => patch('/v1/settings/notifications', changes),
    },
  };
}
