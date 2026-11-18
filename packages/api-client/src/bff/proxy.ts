import { ApiErrorCode } from '../errors';
import type { BffConfig, UpstreamRule } from './config';
import { expireCookie, readCookies, serializeCookie, type CookieOptions } from './cookies';
import { isSafeMethod, newCsrfToken, originAllowed, tokensMatch } from './csrf';
import { secondsUntilExpiry } from './token-lifetime';

const HTTP_FORBIDDEN = 403;
const HTTP_NOT_FOUND = 404;
const HTTP_BAD_GATEWAY = 502;
const HTTP_GATEWAY_TIMEOUT = 504;
const HTTP_UNAUTHORIZED = 401;
const HTTP_NO_CONTENT = 204;
const HTTP_NOT_MODIFIED = 304;
const AUTHORIZATION_HEADER = 'Authorization';
const REAUTH_HEADER = 'X-Reauth-Token';
const NO_STORE = 'no-store';
const INVALID_SEGMENT = /[\\/]|^\.{1,2}$/;
const JSON_TYPE = 'application/json';
const BODYLESS_METHODS = new Set(['GET', 'HEAD']);

export interface BffDependencies {
  config: BffConfig;
  fetchFn?: typeof fetch;
  nowMs?: () => number;
}

type ResolvedDependencies = Required<BffDependencies>;

function problem(status: number, code: string): Response {
  return new Response(JSON.stringify({ code }), {
    status,
    headers: { 'Content-Type': JSON_TYPE, 'Cache-Control': NO_STORE },
  });
}

function secureFor(config: BffConfig, request: Request): boolean {
  const forwarded = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim();
  return config.secureCookies || forwarded === 'https' || new URL(request.url).protocol === 'https:';
}

function cookieBase(config: BffConfig, request: Request, httpOnly: boolean): CookieOptions {
  return { httpOnly, secure: secureFor(config, request), sameSite: config.sameSite };
}

function safePath(segments: string[]): string | undefined {
  if (segments.length === 0 || segments.some((segment) => !segment || INVALID_SEGMENT.test(segment))) {
    return undefined;
  }
  return `/${segments.map(encodeURIComponent).join('/')}`;
}

function withCsrfCookie(response: Response, config: BffConfig, request: Request, cookies: Record<string, string>): Response {
  if (!cookies[config.csrfCookie]) {
    response.headers.append('Set-Cookie', serializeCookie(config.csrfCookie, newCsrfToken(), cookieBase(config, request, false)));
  }
  return response;
}

function upstreamHeaders(request: Request, config: BffConfig, rule: UpstreamRule, cookies: Record<string, string>): Headers {
  const headers = new Headers();
  for (const name of config.requestHeaders) {
    const value = request.headers.get(name);
    if (value) {
      headers.set(name, value);
    }
  }
  const session = cookies[config.sessionCookie];
  if (rule.attachSession && session) {
    headers.set(AUTHORIZATION_HEADER, `Bearer ${session}`);
  }
  const reauth = config.reauthCookie ? cookies[config.reauthCookie] : undefined;
  if (rule.attachSession && reauth) {
    headers.set(REAUTH_HEADER, reauth);
  }
  return headers;
}

function downstreamHeaders(upstream: Response, config: BffConfig): Headers {
  const headers = new Headers();
  for (const name of config.responseHeaders) {
    const value = upstream.headers.get(name);
    if (value) {
      headers.set(name, value);
    }
  }
  return headers;
}

function clearSession(headers: Headers, config: BffConfig, request: Request): void {
  const base = cookieBase(config, request, true);
  headers.append('Set-Cookie', expireCookie(config.sessionCookie, base));
  if (config.reauthCookie) {
    headers.append('Set-Cookie', expireCookie(config.reauthCookie, base));
  }
}

interface TokenSwap {
  body: string;
  cookies: string[];
}

function swapTokens(raw: string, config: BffConfig, request: Request, rule: UpstreamRule, path: string, nowMs: number): TokenSwap | undefined {
  const isSession = rule.sessionPaths.includes(path);
  const isReauth = rule.reauthPaths.includes(path);
  if (!isSession && !isReauth) {
    return undefined;
  }
  const field = isSession ? config.sessionField : config.reauthField;
  const cookieName = isSession ? config.sessionCookie : config.reauthCookie;
  const parsed = JSON.parse(raw) as Record<string, unknown>;
  const token = parsed[field];
  if (typeof token !== 'string' || !cookieName) {
    return undefined;
  }
  const maxAgeSeconds = secondsUntilExpiry(token, nowMs, config.fallbackMaxAgeSeconds);
  parsed[field] = '';
  const cookies = [serializeCookie(cookieName, token, { ...cookieBase(config, request, true), maxAgeSeconds })];
  if (isSession) {
    cookies.push(serializeCookie(config.csrfCookie, newCsrfToken(), cookieBase(config, request, false)));
  }
  return { body: JSON.stringify(parsed), cookies };
}

async function callUpstream(request: Request, path: string, rule: UpstreamRule, deps: ResolvedDependencies, cookies: Record<string, string>): Promise<Response> {
  const method = request.method.toUpperCase();
  const body = BODYLESS_METHODS.has(method) ? undefined : await request.arrayBuffer();
  return deps.fetchFn(`${rule.baseUrl}${path}${new URL(request.url).search}`, {
    method,
    headers: upstreamHeaders(request, deps.config, rule, cookies),
    body: body && body.byteLength > 0 ? body : undefined,
    redirect: 'manual',
    signal: AbortSignal.timeout(deps.config.timeoutMs),
  });
}

async function forward(request: Request, path: string, rule: UpstreamRule, deps: ResolvedDependencies, cookies: Record<string, string>): Promise<Response> {
  const { config } = deps;
  let upstream: Response;
  try {
    upstream = await callUpstream(request, path, rule, deps, cookies);
  } catch (error) {
    const timedOut = error instanceof Error && error.name === 'TimeoutError';
    return problem(timedOut ? HTTP_GATEWAY_TIMEOUT : HTTP_BAD_GATEWAY, timedOut ? ApiErrorCode.Timeout : ApiErrorCode.ServiceUnavailable);
  }
  const headers = downstreamHeaders(upstream, config);
  if (rule.signOutPaths.includes(path) || upstream.status === HTTP_UNAUTHORIZED) {
    clearSession(headers, config, request);
  }
  if (upstream.status === HTTP_NO_CONTENT || upstream.status === HTTP_NOT_MODIFIED) {
    return new Response(null, { status: upstream.status, headers });
  }
  const isJson = (upstream.headers.get('content-type') ?? '').includes(JSON_TYPE);
  if (upstream.ok && isJson) {
    const text = await upstream.text();
    const swapped = swapTokens(text, config, request, rule, path, deps.nowMs());
    if (swapped) {
      swapped.cookies.forEach((cookie) => headers.append('Set-Cookie', cookie));
      headers.set('Cache-Control', NO_STORE);
    }
    return new Response(swapped?.body ?? text, { status: upstream.status, headers });
  }
  return new Response(upstream.body, { status: upstream.status, headers });
}

function passesCsrf(request: Request, config: BffConfig, cookies: Record<string, string>): boolean {
  return originAllowed(request.headers, request.url, config.allowedOrigins) && tokensMatch(cookies[config.csrfCookie], request.headers.get(config.csrfHeader));
}

export async function handleBffRequest(request: Request, segments: string[], dependencies: BffDependencies): Promise<Response> {
  const deps: ResolvedDependencies = { fetchFn: (...args) => fetch(...args), nowMs: Date.now, ...dependencies };
  const { config } = deps;
  const cookies = readCookies(request.headers.get('cookie'));
  const [upstreamName, ...rest] = segments;
  if (upstreamName === config.csrfPath && rest.length === 0 && isSafeMethod(request.method)) {
    return withCsrfCookie(new Response(null, { status: HTTP_NO_CONTENT, headers: { 'Cache-Control': NO_STORE } }), config, request, cookies);
  }
  const rule = upstreamName ? config.upstreams[upstreamName] : undefined;
  const path = safePath(rest);
  if (!rule || !rule.baseUrl || !path) {
    return problem(HTTP_NOT_FOUND, ApiErrorCode.NotFound);
  }
  if (!isSafeMethod(request.method) && !passesCsrf(request, config, cookies)) {
    return problem(HTTP_FORBIDDEN, ApiErrorCode.Forbidden);
  }
  return withCsrfCookie(await forward(request, path, rule, deps, cookies), config, request, cookies);
}
