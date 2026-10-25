import { describe, expect, it, vi } from 'vitest';
import { ApiErrorCode, isApiError } from '../errors';
import { ApplicationFilter } from '../types';
import { createHttpApi } from './http-api';
import { createHttpClient } from './http-client';

function jsonResponse(status: number, body?: unknown): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function setup(response: Response | Error, token?: string) {
  const fetchFn = vi.fn(async () => {
    if (response instanceof Error) {
      throw response;
    }
    return response;
  });
  const onUnauthorized = vi.fn();
  const api = createHttpApi(
    createHttpClient({ baseUrl: 'https://api.example.com/', timeoutMs: 1000, fetchFn: fetchFn as unknown as typeof fetch, getAccessToken: () => token, onUnauthorized }),
  );
  return { api, fetchFn, onUnauthorized };
}

describe('http api', () => {
  it('sends authenticated JSON requests to versioned paths', async () => {
    const { api, fetchFn } = setup(jsonResponse(200, []), 'tok');
    await api.applications.listApplications(ApplicationFilter.Attention);
    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.example.com/v1/applications?filter=attention');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer tok');
  });

  it('encodes path parameters and sends bodies', async () => {
    const { api, fetchFn } = setup(jsonResponse(200, {}));
    await api.approvals.updateAnswer('a/1', 'q 2', 'Yes');
    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.example.com/v1/approvals/a%2F1/answers/q%202');
    expect(init.method).toBe('PUT');
    expect(init.body).toBe(JSON.stringify({ answer: 'Yes' }));
  });

  it('handles empty responses', async () => {
    const { api } = setup(new Response(null, { status: 204 }));
    await expect(api.auth.signOut()).resolves.toBeUndefined();
  });

  it('maps problem details and status codes to error codes', async () => {
    const coded = setup(jsonResponse(400, { code: 'email_taken' }));
    const error = await coded.api.auth.register({ fullName: 'a', email: 'b', password: 'c', consent: true, consentDocuments: { terms: '1', privacy: '1' } }).catch((e: unknown) => e);
    expect(isApiError(error, ApiErrorCode.EmailTaken)).toBe(true);

    const missing = setup(jsonResponse(404));
    expect(isApiError(await missing.api.profile.getProfile().catch((e: unknown) => e), ApiErrorCode.NotFound)).toBe(true);
  });

  it('notifies on unauthorized responses', async () => {
    const { api, onUnauthorized } = setup(jsonResponse(401, { code: 'unauthorized' }));
    await api.dashboard.getDashboard().catch(() => undefined);
    expect(onUnauthorized).toHaveBeenCalledOnce();
  });

  it('maps network failures', async () => {
    const { api } = setup(new TypeError('offline'));
    expect(isApiError(await api.config.getPublicConfig().catch((e: unknown) => e), ApiErrorCode.Network)).toBe(true);
  });

  it('calls fetch without binding it to another object', async () => {
    function strictFetch(this: unknown): Promise<Response> {
      if (this !== undefined) {
        return Promise.reject(new TypeError('Illegal invocation'));
      }
      return Promise.resolve(jsonResponse(200, {}));
    }
    const api = createHttpApi(createHttpClient({ baseUrl: 'https://api.example.com', timeoutMs: 1000, fetchFn: strictFetch as unknown as typeof fetch, getAccessToken: () => undefined }));
    await expect(api.config.getPublicConfig()).resolves.toEqual({});
  });
});
