import { HttpMethod, type HttpClient } from '../http/http-client';
import type { AutomationApi } from './ports';

const enc = encodeURIComponent;

export function createHttpAutomation(http: HttpClient): AutomationApi {
  const request = <T>(method: HttpMethod, path: string, body?: unknown) => http.request<T>(method, path, body);
  return {
    overview: () => request(HttpMethod.Get, '/v1/automation'),
    createRule: (input) => request(HttpMethod.Post, '/v1/automation/rules', input),
    updateRule: (id, input) => request(HttpMethod.Put, `/v1/automation/rules/${enc(id)}`, input),
    deleteRule: (id) => request(HttpMethod.Delete, `/v1/automation/rules/${enc(id)}`),
    reorderRules: (ruleIds) => request(HttpMethod.Put, '/v1/automation/rules/order', { ruleIds }),
    updateSettings: (input) => request(HttpMethod.Put, '/v1/automation/settings', input),
    dryRun: (ruleId) => request(HttpMethod.Post, '/v1/automation/dry-run', ruleId ? { ruleId } : {}),
  };
}
