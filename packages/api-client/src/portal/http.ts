import { HttpMethod, type HttpClient } from '../http/http-client';
import type { PortalAdminApi, PortalApi } from './ports';

const enc = encodeURIComponent;

export function createHttpPortal(http: HttpClient): PortalApi {
  const get = <T>(path: string) => http.request<T>(HttpMethod.Get, path);
  const post = <T>(path: string, body?: unknown) => http.request<T>(HttpMethod.Post, path, body ?? {});
  const put = <T>(path: string, body: unknown) => http.request<T>(HttpMethod.Put, path, body);
  const del = <T>(path: string) => http.request<T>(HttpMethod.Delete, path);
  const base = '/v1/portal';
  const application = (id: string) => `${base}/applications/${enc(id)}`;

  return {
    autopilot: () => get(`${base}/autopilot`),
    enableAutopilot: (input) => put(`${base}/autopilot`, input),
    disableAutopilot: () => del(`${base}/autopilot`),
    listAccounts: () => get(`${base}/accounts`),
    addAccount: (input) => post(`${base}/accounts`, input),
    exportAccounts: () => get(`${base}/accounts/export`),
    revealAccount: (id) => get(`${base}/accounts/${enc(id)}/secret`),
    removeAccount: (id) => del(`${base}/accounts/${enc(id)}`),
    attempt: (applicationId) => get(`${application(applicationId)}/attempt`),
    resume: (applicationId, input) => post(`${application(applicationId)}/resume`, input),
    complete: (applicationId, input) => post(`${application(applicationId)}/complete`, input),
    fillPlan: (applicationId) => get(`${application(applicationId)}/fill-plan`),
    fillPassword: (applicationId) => get(`${application(applicationId)}/fill-plan/password`),
    evidenceLink: (applicationId) => get(`${application(applicationId)}/evidence`),
    requestReadiness: (url) => post(`${base}/readiness`, { url }),
    readinessReport: (reportId) => get(`${base}/readiness/${enc(reportId)}`),
  };
}

export function createHttpPortalAdmin(http: HttpClient): PortalAdminApi {
  const base = '/admin/v1/portals';
  return {
    listHosts: () => http.request(HttpMethod.Get, `${base}/hosts`),
    decideHost: (host, input) => http.request(HttpMethod.Put, `${base}/hosts/${enc(host)}`, input),
    requestReadiness: (url) => http.request(HttpMethod.Post, `${base}/readiness`, { url }),
    readiness: (userId, reportId) => http.request(HttpMethod.Get, `${base}/readiness/${enc(userId)}/${enc(reportId)}`),
  };
}
