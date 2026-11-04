import { HttpMethod, RequestPace, type HttpClient } from '../http/http-client';
import type { WritingApi } from './ports';

const enc = encodeURIComponent;
const BASE = '/v1/writing';

export function draftQuery(filter: { opportunityId?: string; kind?: string } = {}): string {
  const params = new URLSearchParams();
  if (filter.opportunityId) {
    params.set('opportunityId', filter.opportunityId);
  }
  if (filter.kind) {
    params.set('kind', filter.kind);
  }
  const text = params.toString();
  return text ? `?${text}` : '';
}

export function createHttpWriting(http: HttpClient): WritingApi {
  const get = <T>(path: string) => http.request<T>(HttpMethod.Get, path);
  const post = <T>(path: string, body?: unknown, pace?: RequestPace) => http.request<T>(HttpMethod.Post, path, body ?? {}, pace);
  return {
    status: () => get(`${BASE}/status`),
    listDrafts: (filter) => get(`${BASE}/drafts${draftQuery(filter)}`),
    generate: (input) => post(`${BASE}/drafts`, input, RequestPace.Long),
    getDraft: (id) => get(`${BASE}/drafts/${enc(id)}`),
    editDraft: (id, text) => http.request(HttpMethod.Put, `${BASE}/drafts/${enc(id)}`, { text }),
    removeDraft: (id) => http.request(HttpMethod.Delete, `${BASE}/drafts/${enc(id)}`),
    recheck: (id) => post(`${BASE}/drafts/${enc(id)}/check`),
    stripFlagged: (id) => post(`${BASE}/drafts/${enc(id)}/strip-flagged`),
    attach: (id, approvalId) => post(`${BASE}/drafts/${enc(id)}/attach`, { approvalId }),
    detach: (id, approvalId) => post(`${BASE}/drafts/${enc(id)}/detach`, { approvalId }),
  };
}
