import { HttpMethod, type HttpClient } from '../http/http-client';
import type { FeesApi } from './ports';

const enc = encodeURIComponent;

export function createHttpFees(http: HttpClient): FeesApi {
  const get = <T>(path: string) => http.request<T>(HttpMethod.Get, path);
  const post = <T>(path: string, body?: unknown) => http.request<T>(HttpMethod.Post, path, body ?? {});
  const put = <T>(path: string, body: unknown) => http.request<T>(HttpMethod.Put, path, body);
  const del = <T>(path: string) => http.request<T>(HttpMethod.Delete, path);
  const base = '/v1/fees';
  const payment = (id: string) => `${base}/payments/${enc(id)}`;

  return {
    reference: () => get(`${base}/reference`),
    overview: () => get(`${base}/overview`),
    listRules: () => get(`${base}/rules`),
    createRule: (input) => post(`${base}/rules`, input),
    updateRule: (id, input) => put(`${base}/rules/${enc(id)}`, input),
    removeRule: (id) => del(`${base}/rules/${enc(id)}`),
    paymentFromRule: (ruleId) => post(`${base}/rules/${enc(ruleId)}/payments`),
    listPayments: () => get(`${base}/payments`),
    getPayment: (id) => get(payment(id)),
    createPayment: (input) => post(`${base}/payments`, input),
    updatePayment: (id, input) => put(payment(id), input),
    removePayment: (id) => del(payment(id)),
    recordAction: (id, input) => post(`${payment(id)}/actions`, input),
    addReceipt: (id, input) => post(`${payment(id)}/receipts`, input),
    removeReceipt: (id, receiptId) => del(`${payment(id)}/receipts/${enc(receiptId)}`),
  };
}
