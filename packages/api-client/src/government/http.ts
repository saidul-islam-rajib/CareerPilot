import { HttpMethod, type HttpClient } from '../http/http-client';
import { uploadForm } from '../http/http-api';
import type { GovernmentAdminApi, GovernmentApi } from './ports';
import type { CircularFilters, SecretValues } from './types';

const enc = encodeURIComponent;
const GRADE_SEPARATOR = ',';
const SECRETS_KEY = 'values';

export function circularQuery(filters: CircularFilters = {}): string {
  const params = new URLSearchParams();
  if (filters.grades?.length) {
    params.set('grades', filters.grades.join(GRADE_SEPARATOR));
  }
  if (filters.gradeMin !== undefined) {
    params.set('gradeMin', String(filters.gradeMin));
  }
  if (filters.gradeMax !== undefined) {
    params.set('gradeMax', String(filters.gradeMax));
  }
  if (filters.authority) {
    params.set('authority', filters.authority);
  }
  if (filters.location) {
    params.set('location', filters.location);
  }
  if (filters.phase) {
    params.set('phase', filters.phase);
  }
  if (filters.eligibleOnly) {
    params.set('eligibleOnly', 'true');
  }
  const text = params.toString();
  return text ? `?${text}` : '';
}

export function createHttpGovernment(http: HttpClient): GovernmentApi {
  const get = <T>(path: string) => http.request<T>(HttpMethod.Get, path);
  const post = <T>(path: string, body?: unknown) => http.request<T>(HttpMethod.Post, path, body ?? {});
  const put = <T>(path: string, body: unknown) => http.request<T>(HttpMethod.Put, path, body);
  const patch = <T>(path: string, body: unknown) => http.request<T>(HttpMethod.Patch, path, body);
  const del = <T>(path: string) => http.request<T>(HttpMethod.Delete, path);
  const base = '/v1/government';
  const application = (id: string) => `${base}/applications/${enc(id)}`;

  return {
    reference: () => get(`${base}/reference`),
    listCirculars: (filters) => get(`${base}/circulars${circularQuery(filters)}`),
    getCircular: (id) => get(`${base}/circulars/${enc(id)}`),
    getCircularVersion: (id, version) => get(`${base}/circulars/${enc(id)}/versions/${version}`),
    listApplications: () => get(`${base}/applications`),
    getApplication: (id) => get(application(id)),
    startApplication: (circularId, postIds) => post(`${base}/applications`, { circularId, postIds }),
    withdrawApplication: (id) => del(application(id)),
    markSubmitted: (id) => post(`${application(id)}/submitted`),
    confirmApplication: (id) => post(`${application(id)}/confirmed`),
    updateFee: (id, change) => patch(`${application(id)}/fee`, change),
    addStage: (id, stage) => post(`${application(id)}/stages`, stage),
    updateStage: (id, stageId, stage) => put(`${application(id)}/stages/${enc(stageId)}`, stage),
    removeStage: (id, stageId) => del(`${application(id)}/stages/${enc(stageId)}`),
    addCopy: (id, file) => post(`${application(id)}/copies`, uploadForm(file)),
    removeCopy: (id, copyId) => del(`${application(id)}/copies/${enc(copyId)}`),
    setSecrets: (id, values) => put(`${application(id)}/secrets`, { [SECRETS_KEY]: values }),
    async revealSecrets(id) {
      const body = await post<{ values: SecretValues }>(`${application(id)}/secrets/reveal`);
      return body.values;
    },
    guide: (id) => get(`${application(id)}/guide`),
    upcoming: () => get(`${base}/upcoming`),
  };
}

export function createHttpGovernmentAdmin(http: HttpClient): GovernmentAdminApi {
  const get = <T>(path: string) => http.request<T>(HttpMethod.Get, path);
  const post = <T>(path: string, body?: unknown) => http.request<T>(HttpMethod.Post, path, body ?? {});
  const put = <T>(path: string, body: unknown) => http.request<T>(HttpMethod.Put, path, body);
  const del = <T>(path: string) => http.request<T>(HttpMethod.Delete, path);
  const base = '/admin/v1/government';
  const circular = (id: string) => `${base}/circulars/${enc(id)}`;

  return {
    reference: () => get(`${base}/reference`),
    listCirculars: () => get(`${base}/circulars`),
    getCircular: (id) => get(circular(id)),
    createCircular: (content) => post(`${base}/circulars`, content),
    updateCircular: (id, content) => put(circular(id), content),
    publishCircular: (id) => post(`${circular(id)}/publish`),
    withdrawCircular: (id) => post(`${circular(id)}/withdraw`),
    setLiveRemoved: (id, removed) => put(`${circular(id)}/live-removed`, { removed }),
    addNotice: (id, notice) => post(`${circular(id)}/notices`, notice),
    removeCircular: (id) => del(circular(id)),
    importFromLink: (url) => post(`${base}/circulars/import`, { url }),
    listHolidays: () => get(`${base}/holidays`),
    addHoliday: (on, name) => post(`${base}/holidays`, { on, name }),
    removeHoliday: (id) => del(`${base}/holidays/${enc(id)}`),
  };
}
