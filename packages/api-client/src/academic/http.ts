import { HttpMethod, type HttpClient } from '../http/http-client';
import type { AcademicApi } from './ports';

const enc = encodeURIComponent;
const IDS_SEPARATOR = ',';

export function offersQuery(ids?: string[]): string {
  return ids?.length ? `?ids=${enc(ids.join(IDS_SEPARATOR))}` : '';
}

export function createHttpAcademic(http: HttpClient): AcademicApi {
  const get = <T>(path: string) => http.request<T>(HttpMethod.Get, path);
  const post = <T>(path: string, body?: unknown) => http.request<T>(HttpMethod.Post, path, body ?? {});
  const put = <T>(path: string, body: unknown) => http.request<T>(HttpMethod.Put, path, body);
  const del = <T>(path: string) => http.request<T>(HttpMethod.Delete, path);
  const base = '/v1/academic';

  return {
    reference: () => get(`${base}/reference`),
    overview: () => get(`${base}/overview`),
    getSettings: () => get(`${base}/settings`),
    updateSettings: (settings) => put(`${base}/settings`, settings),
    listPrograms: () => get(`${base}/programs`),
    getProgram: (id) => get(`${base}/programs/${enc(id)}`),
    createProgram: (input) => post(`${base}/programs`, input),
    createProgramFromOpportunity: (opportunityId) => post(`${base}/programs/from-opportunity`, { opportunityId }),
    updateProgram: (id, input) => put(`${base}/programs/${enc(id)}`, input),
    removeProgram: (id) => del(`${base}/programs/${enc(id)}`),
    plan: (id) => get(`${base}/programs/${enc(id)}/plan`),
    recordAction: (id, action, confirmed) =>
      post(`${base}/programs/${enc(id)}/decision/actions`, {
        action,
        confirmed,
      }),
    decisionMessage: (id, action) => get(`${base}/programs/${enc(id)}/decision/message?action=${enc(action)}`),
    generateChecklist: (id) => post(`${base}/programs/${enc(id)}/checklist`),
    compareOffers: (ids) => get(`${base}/offers/compare${offersQuery(ids)}`),
    listExams: () => get(`${base}/tests`),
    createExam: (input) => post(`${base}/tests`, input),
    updateExam: (id, input) => put(`${base}/tests/${enc(id)}`, input),
    removeExam: (id) => del(`${base}/tests/${enc(id)}`),
    listCredentials: () => get(`${base}/credentials`),
    createCredential: (input) => post(`${base}/credentials`, input),
    updateCredential: (id, input) => put(`${base}/credentials/${enc(id)}`, input),
    removeCredential: (id) => del(`${base}/credentials/${enc(id)}`),
    listReferees: () => get(`${base}/referees`),
    createReferee: (input) => post(`${base}/referees`, input),
    updateReferee: (id, input) => put(`${base}/referees/${enc(id)}`, input),
    setRefereeConsent: (id, confirmed) => put(`${base}/referees/${enc(id)}/consent`, { confirmed }),
    removeReferee: (id) => del(`${base}/referees/${enc(id)}`),
    listRecommendations: (programId) => get(`${base}/recommendations${programId ? `?programId=${enc(programId)}` : ''}`),
    createRecommendation: (input) => post(`${base}/recommendations`, input),
    updateRecommendation: (id, input) => put(`${base}/recommendations/${enc(id)}`, input),
    setRecommendationStatus: (id, change) => post(`${base}/recommendations/${enc(id)}/status`, change),
    recommendationDraft: (id, kind) => get(`${base}/recommendations/${enc(id)}/draft?kind=${enc(kind)}`),
    removeRecommendation: (id) => del(`${base}/recommendations/${enc(id)}`),
    listOutreach: () => get(`${base}/outreach`),
    draftOutreach: (input) => post(`${base}/outreach`, input),
    updateOutreach: (id, input) => put(`${base}/outreach/${enc(id)}`, input),
    markOutreachSent: (id, on) => post(`${base}/outreach/${enc(id)}/sent`, on ? { on } : {}),
    recordOutreachReply: (id, outcome, note) => post(`${base}/outreach/${enc(id)}/reply`, { outcome, note: note ?? '' }),
    removeOutreach: (id) => del(`${base}/outreach/${enc(id)}`),
  };
}
