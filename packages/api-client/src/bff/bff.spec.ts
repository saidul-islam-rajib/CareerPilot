import { describe, expect, it } from 'vitest';
import { ApiErrorCode } from '../errors';
import { createBffFetch } from './bff-fetch';
import { resolveBffConfig, type BffConfig, type RawBff } from './config';
import { expireCookie, readCookies, serializeCookie } from './cookies';
import { isSafeMethod, newCsrfToken, originAllowed, tokensMatch } from './csrf';
import { handleBffRequest } from './proxy';
import { secondsUntilExpiry } from './token-lifetime';

const raw: RawBff = {
  sameSite: 'lax',
  secureCookies: false,
  csrfHeader: 'X-CSRF-Token',
  csrfPath: 'csrf',
  timeoutMs: 1000,
  sessionField: 'accessToken',
  reauthField: 'reauthToken',
  fallbackMaxAgeSeconds: 60,
  requestHeaders: ['accept', 'content-type'],
  responseHeaders: ['content-type'],
  admin: {
    basePath: '/api/bff',
    sessionCookie: 'sess',
    reauthCookie: 'reauth',
    csrfCookie: 'csrf',
    allowedOrigins: ['http://app.test'],
    upstreams: {
      api: {
        urlEnv: 'API_URL',
        attachSession: true,
        sessionPaths: ['/v1/sign-in'],
        reauthPaths: ['/v1/reauth'],
        signOutPaths: ['/v1/sign-out'],
      },
      open: { urlEnv: 'OPEN_URL', attachSession: false },
    },
  },
};

const NOW_MS = 1_000_000_000;

function jwt(exp: number): string {
  return `h.${btoa(JSON.stringify({ exp }))}.s`;
}

function config(overrides: Partial<BffConfig> = {}): BffConfig {
  return { ...resolveBffConfig(raw, 'admin', { open: 'http://open.test' }, { API_URL: 'http://api.test/' }), ...overrides };
}

interface Call {
  url: string;
  init: RequestInit;
}

function upstream(response: Response, calls: Call[] = []): typeof fetch {
  return async (input, init) => {
    calls.push({ url: String(input), init: init ?? {} });
    return response;
  };
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

function post(path: string, headers: Record<string, string> = {}, body = '{}'): Request {
  return new Request(`http://app.test${path}`, { method: 'POST', body, headers });
}

const CSRF = 'token-value';
const guarded = { origin: 'http://app.test', cookie: `csrf=${CSRF}`, 'x-csrf-token': CSRF, 'content-type': 'application/json' };

describe('resolveBffConfig', () => {
  it('reads upstream addresses from the environment and falls back', () => {
    const resolved = config();
    expect(resolved.upstreams.api?.baseUrl).toBe('http://api.test');
    expect(resolved.upstreams.open?.baseUrl).toBe('http://open.test');
  });

  it('rejects a missing app section', () => {
    expect(() => resolveBffConfig(raw, 'web', {}, {})).toThrow();
  });
});

describe('cookies', () => {
  it('serializes httpOnly secure cookies with max age', () => {
    expect(serializeCookie('a', 'b c', { httpOnly: true, secure: true, sameSite: 'strict', maxAgeSeconds: 5 })).toBe(
      'a=b%20c; Path=/; SameSite=Strict; HttpOnly; Secure; Max-Age=5',
    );
  });

  it('expires and reads cookies', () => {
    expect(expireCookie('a', { httpOnly: true, secure: false, sameSite: 'lax' })).toContain('Max-Age=0');
    expect(readCookies('a=1; b=%20x; bad')).toEqual({ a: '1', b: ' x' });
    expect(readCookies(null)).toEqual({});
    expect(readCookies('a=%E0%A4%A')).toEqual({ a: '%E0%A4%A' });
  });
});

describe('csrf helpers', () => {
  it('compares tokens', () => {
    expect(tokensMatch('abc', 'abc')).toBe(true);
    expect(tokensMatch('abc', 'abd')).toBe(false);
    expect(tokensMatch(undefined, 'abc')).toBe(false);
    expect(tokensMatch('abc', null)).toBe(false);
    expect(newCsrfToken()).not.toBe(newCsrfToken());
    expect(isSafeMethod('get')).toBe(true);
    expect(isSafeMethod('POST')).toBe(false);
  });

  it('checks origins', () => {
    const url = 'http://app.test/x';
    expect(originAllowed(new Headers({ origin: 'http://app.test' }), url, [])).toBe(true);
    expect(originAllowed(new Headers({ origin: 'http://other.test' }), url, ['http://other.test'])).toBe(true);
    expect(originAllowed(new Headers({ origin: 'http://evil.test' }), url, [])).toBe(false);
    expect(originAllowed(new Headers(), url, [])).toBe(false);
    expect(originAllowed(new Headers({ origin: 'http://app.test', 'sec-fetch-site': 'cross-site' }), url, [])).toBe(false);
    const forwarded = new Headers({ origin: 'https://front.test', 'x-forwarded-host': 'front.test', 'x-forwarded-proto': 'https' });
    expect(originAllowed(forwarded, url, [])).toBe(true);
  });
});

describe('secondsUntilExpiry', () => {
  it('reads exp or falls back', () => {
    expect(secondsUntilExpiry(jwt(NOW_MS / 1000 + 90), NOW_MS, 5)).toBe(90);
    expect(secondsUntilExpiry(jwt(1), NOW_MS, 5)).toBe(0);
    expect(secondsUntilExpiry('opaque', NOW_MS, 5)).toBe(5);
    expect(secondsUntilExpiry('a.!!.c', NOW_MS, 5)).toBe(5);
    expect(secondsUntilExpiry(`h.${btoa('{}')}.s`, NOW_MS, 5)).toBe(5);
  });
});

describe('handleBffRequest', () => {
  it('issues a csrf cookie', async () => {
    const response = await handleBffRequest(new Request('http://app.test/api/bff/csrf'), ['csrf'], { config: config() });
    expect(response.status).toBe(204);
    expect(response.headers.get('set-cookie')).toMatch(/^csrf=.+SameSite=Lax$/);
  });

  it('rejects unknown upstreams and unsafe paths', async () => {
    const deps = { config: config(), fetchFn: upstream(json({})) };
    const bad = [['nope', 'v1', 'x'], ['api'], ['api', '..', 'x'], ['api', 'a/b'], ['api', '', 'x'], ['api', 'a\\b']];
    for (const segments of bad) {
      const response = await handleBffRequest(new Request('http://app.test/x'), segments, deps);
      expect(response.status).toBe(404);
    }
  });

  it('blocks state changes without origin, token or match', async () => {
    const deps = { config: config(), fetchFn: upstream(json({})) };
    const noToken = await handleBffRequest(post('/x', { origin: 'http://app.test' }), ['api', 'v1', 'x'], deps);
    const wrongOrigin = await handleBffRequest(post('/x', { ...guarded, origin: 'http://evil.test' }), ['api', 'v1', 'x'], deps);
    const mismatch = await handleBffRequest(post('/x', { ...guarded, 'x-csrf-token': 'other' }), ['api', 'v1', 'x'], deps);
    for (const response of [noToken, wrongOrigin, mismatch]) {
      expect(response.status).toBe(403);
      expect((await response.json()).code).toBe(ApiErrorCode.Forbidden);
    }
  });

  it('attaches the session and reauth cookies and forwards body and query', async () => {
    const calls: Call[] = [];
    const request = new Request('http://app.test/x?page=2', {
      method: 'POST',
      body: '{"a":1}',
      headers: { ...guarded, cookie: `csrf=${CSRF}; sess=SESSION; reauth=PROOF`, accept: 'application/json', 'x-secret': 'drop' },
    });
    const response = await handleBffRequest(request, ['api', 'v1', 'items'], { config: config(), fetchFn: upstream(json({ ok: true }), calls) });
    expect(response.status).toBe(200);
    const sent = new Headers(calls[0]?.init.headers);
    expect(calls[0]?.url).toBe('http://api.test/v1/items?page=2');
    expect(sent.get('authorization')).toBe('Bearer SESSION');
    expect(sent.get('x-reauth-token')).toBe('PROOF');
    expect(sent.get('cookie')).toBeNull();
    expect(sent.get('x-secret')).toBeNull();
    expect(sent.get('accept')).toBe('application/json');
    expect(calls[0]?.init.method).toBe('POST');
  });

  it('does not attach the session to upstreams that opt out', async () => {
    const calls: Call[] = [];
    const request = new Request('http://app.test/x', { headers: { cookie: 'sess=SESSION; reauth=PROOF' } });
    const response = await handleBffRequest(request, ['open', 'v1', 'config'], { config: config(), fetchFn: upstream(json({}), calls) });
    const sent = new Headers(calls[0]?.init.headers);
    expect(sent.get('authorization')).toBeNull();
    expect(sent.get('x-reauth-token')).toBeNull();
    expect(response.headers.get('set-cookie')).toContain('csrf=');
  });

  it('moves the access token into an httpOnly cookie on sign-in', async () => {
    const token = jwt(NOW_MS / 1000 + 120);
    const response = await handleBffRequest(post('/x', guarded), ['api', 'v1', 'sign-in'], {
      config: config(),
      nowMs: () => NOW_MS,
      fetchFn: upstream(json({ accessToken: token, user: { id: 'u1' } })),
    });
    expect(await response.json()).toEqual({ accessToken: '', user: { id: 'u1' } });
    const cookies = response.headers.getSetCookie();
    expect(cookies[0]).toBe(`sess=${encodeURIComponent(token)}; Path=/; SameSite=Lax; HttpOnly; Max-Age=120`);
    expect(cookies[1]).toMatch(/^csrf=.+; Path=\/; SameSite=Lax$/);
    expect(cookies[1]).not.toContain('HttpOnly');
    expect(response.headers.get('cache-control')).toBe('no-store');
  });

  it('keeps the reauth proof out of the body and marks https cookies secure', async () => {
    const token = jwt(NOW_MS / 1000 + 30);
    const request = new Request('https://app.test/x', { method: 'POST', body: '{}', headers: { ...guarded, origin: 'https://app.test' } });
    const response = await handleBffRequest(request, ['api', 'v1', 'reauth'], {
      config: config(),
      nowMs: () => NOW_MS,
      fetchFn: upstream(json({ reauthToken: token, expiresAt: 'later' })),
    });
    expect(await response.json()).toEqual({ reauthToken: '', expiresAt: 'later' });
    const cookies = response.headers.getSetCookie();
    expect(cookies).toHaveLength(1);
    expect(cookies[0]).toContain('reauth=');
    expect(cookies[0]).toContain('Secure');
    expect(cookies[0]).toContain('HttpOnly');
  });

  it('forces secure cookies from config and forwarded protocol', async () => {
    const forced = await handleBffRequest(new Request('http://app.test/x'), ['csrf'], { config: config({ secureCookies: true }) });
    expect(forced.headers.get('set-cookie')).toContain('Secure');
    const headers = { 'x-forwarded-proto': 'https' };
    const proxied = await handleBffRequest(new Request('http://app.test/x', { headers }), ['csrf'], { config: config() });
    expect(proxied.headers.get('set-cookie')).toContain('Secure');
  });

  it('passes the body through when sign-in fails or carries no token', async () => {
    const failed = await handleBffRequest(post('/x', guarded), ['api', 'v1', 'sign-in'], {
      config: config(),
      fetchFn: upstream(json({ code: 'invalid_credentials' }, 400)),
    });
    expect(failed.status).toBe(400);
    expect(await failed.json()).toEqual({ code: 'invalid_credentials' });
    expect(failed.headers.getSetCookie().some((c) => c.startsWith('sess='))).toBe(false);
    const empty = await handleBffRequest(post('/x', guarded), ['api', 'v1', 'sign-in'], { config: config(), fetchFn: upstream(json({ mfa: true })) });
    expect(await empty.json()).toEqual({ mfa: true });
  });

  it('clears cookies on sign-out and on upstream 401', async () => {
    const out = await handleBffRequest(post('/x', guarded), ['api', 'v1', 'sign-out'], {
      config: config(),
      fetchFn: upstream(new Response(null, { status: 204 })),
    });
    expect(out.status).toBe(204);
    expect(out.headers.getSetCookie().filter((c) => c.includes('Max-Age=0'))).toHaveLength(2);
    const expired = await handleBffRequest(new Request('http://app.test/x', { headers: { cookie: 'sess=old' } }), ['api', 'v1', 'me'], {
      config: config(),
      fetchFn: upstream(json({ code: 'unauthorized' }, 401)),
    });
    expect(expired.status).toBe(401);
    expect(expired.headers.getSetCookie().some((c) => c.startsWith('sess=;'))).toBe(true);
  });

  it('streams non-json responses with allowed headers only', async () => {
    const file = new Response('pdf', { status: 200, headers: { 'content-type': 'application/pdf', 'x-internal': '1' } });
    const request = new Request('http://app.test/x', { headers: { cookie: 'csrf=a' } });
    const response = await handleBffRequest(request, ['api', 'v1', 'files', 'a b'], { config: config(), fetchFn: upstream(file) });
    expect(await response.text()).toBe('pdf');
    expect(response.headers.get('content-type')).toBe('application/pdf');
    expect(response.headers.get('x-internal')).toBeNull();
    expect(response.headers.get('set-cookie')).toBeNull();
  });

  it('maps upstream failures to gateway errors', async () => {
    const down = await handleBffRequest(new Request('http://app.test/x'), ['api', 'v1', 'x'], {
      config: config(),
      fetchFn: async () => {
        throw new Error('refused');
      },
    });
    expect(down.status).toBe(502);
    const slow = await handleBffRequest(new Request('http://app.test/x'), ['api', 'v1', 'x'], {
      config: config(),
      fetchFn: async () => {
        throw new DOMException('timeout', 'TimeoutError');
      },
    });
    expect(slow.status).toBe(504);
    expect((await slow.json()).code).toBe(ApiErrorCode.Timeout);
  });

  it('uses the global fetch when none is given', async () => {
    const api = { ...config().upstreams.api!, baseUrl: 'http://127.0.0.1:1' };
    const response = await handleBffRequest(new Request('http://app.test/x'), ['api', 'v1', 'x'], { config: config({ upstreams: { api } }) });
    expect(response.status).toBe(502);
  });
});

describe('createBffFetch', () => {
  it('adds the csrf header to unsafe requests and fetches a token first when missing', async () => {
    let cookie: string | undefined;
    const seen: Array<{ url: string; headers: Headers; credentials?: RequestCredentials }> = [];
    const fetchFn: typeof fetch = async (input, init) => {
      seen.push({ url: String(input), headers: new Headers(init?.headers), credentials: init?.credentials });
      if (String(input).endsWith('/csrf')) {
        cookie = 'fresh';
      }
      return new Response(null, { status: 204 });
    };
    const bffFetch = createBffFetch({ csrfHeader: 'X-CSRF-Token', csrfCookie: 'csrf', csrfUrl: '/api/bff/csrf', readCookie: () => cookie, fetchFn });
    await bffFetch('/api/bff/api/v1/x', { method: 'POST' });
    await bffFetch('/api/bff/api/v1/y');
    expect(seen[0]?.url).toBe('/api/bff/csrf');
    expect(seen[1]?.headers.get('x-csrf-token')).toBe('fresh');
    expect(seen[1]?.credentials).toBe('same-origin');
    expect(seen[2]?.headers.get('x-csrf-token')).toBeNull();
  });

  it('reuses an existing token', async () => {
    const seen: string[] = [];
    const fetchFn: typeof fetch = async (input) => {
      seen.push(String(input));
      return new Response(null, { status: 204 });
    };
    const bffFetch = createBffFetch({ csrfHeader: 'h', csrfCookie: 'c', csrfUrl: '/csrf', readCookie: () => 'present', fetchFn });
    await bffFetch('/x', { method: 'DELETE' });
    expect(seen).toEqual(['/x']);
  });
});
