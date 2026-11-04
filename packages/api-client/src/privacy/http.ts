import { HttpMethod, type HttpClient } from '../http/http-client';
import type { AdminPrivacyApi, PrivacyApi } from './ports';

const enc = encodeURIComponent;

export function createHttpPrivacy(http: HttpClient): PrivacyApi {
  const get = <T>(path: string) => http.request<T>(HttpMethod.Get, path);
  const post = <T>(path: string, body?: unknown) => http.request<T>(HttpMethod.Post, path, body ?? {});
  const put = <T>(path: string, body: unknown) => http.request<T>(HttpMethod.Put, path, body);
  return {
    report: (period, date) => get(`/v1/reports/${enc(period)}${date ? `?date=${enc(date)}` : ''}`),
    requestExport: (input) => post('/v1/exports', input),
    listExports: () => get('/v1/exports'),
    getExport: (id) => get(`/v1/exports/${enc(id)}`),
    deletion: () => get('/v1/account/deletion'),
    requestDeletion: (password) => post('/v1/account/deletion', { password }),
    cancelDeletion: () => post('/v1/account/deletion/cancel'),
    consents: () => get('/v1/account/consents'),
    updateConsent: (kind, granted) => put(`/v1/account/consents/${enc(kind)}`, { granted }),
  };
}

export function createHttpPrivacyAdmin(http: HttpClient): AdminPrivacyApi {
  const get = <T>(path: string) => http.request<T>(HttpMethod.Get, path);
  return {
    exports: () => get('/admin/v1/privacy/exports'),
    deletions: () => get('/admin/v1/privacy/deletions'),
    userConsents: (userId) => get(`/admin/v1/users/${enc(userId)}/consents`),
  };
}
