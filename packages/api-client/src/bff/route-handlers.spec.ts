import { describe, expect, it, vi } from 'vitest';
import { resolveBffConfig, type RawBff } from './config';
import { createBffRouteHandlers } from './route-handlers';

const raw: RawBff = {
  sameSite: 'lax',
  secureCookies: false,
  csrfHeader: 'X-CSRF-Token',
  csrfPath: 'csrf',
  timeoutMs: 1000,
  sessionField: 'accessToken',
  reauthField: 'reauthToken',
  fallbackMaxAgeSeconds: 60,
  requestHeaders: [],
  responseHeaders: ['content-type'],
  web: {
    basePath: '/api/bff',
    sessionCookie: 's',
    csrfCookie: 'c',
    allowedOrigins: [],
    upstreams: { user: { urlEnv: 'URL', attachSession: true } },
  },
};

describe('createBffRouteHandlers', () => {
  it('resolves config once and proxies every method', async () => {
    const resolve = vi.fn(() => resolveBffConfig(raw, 'web', {}, { URL: 'http://api.test' }));
    const fetchFn = vi.fn(async () => new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } }));
    const handlers = createBffRouteHandlers(resolve, fetchFn as unknown as typeof fetch);
    const context = { params: Promise.resolve({ path: ['user', 'v1', 'config'] }) };
    const first = await handlers.GET(new Request('http://app.test/x'), context);
    await handlers.HEAD(new Request('http://app.test/x'), context);
    expect(first.status).toBe(200);
    expect(resolve).toHaveBeenCalledTimes(1);
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it('falls back to the global fetch when no fetch is given', async () => {
    const globalFetch = vi.fn(async () => new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } }));
    vi.stubGlobal('fetch', globalFetch);
    try {
      const handlers = createBffRouteHandlers(() => resolveBffConfig(raw, 'web', {}, { URL: 'http://api.test' }));
      const response = await handlers.GET(new Request('http://app.test/x'), { params: Promise.resolve({ path: ['user', 'v1', 'config'] }) });
      expect(response.status).toBe(200);
      expect(globalFetch).toHaveBeenCalledTimes(1);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
