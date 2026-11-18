export const SameSite = {
  Lax: 'lax',
  Strict: 'strict',
} as const;
export type SameSite = (typeof SameSite)[keyof typeof SameSite];

export interface UpstreamRule {
  baseUrl: string;
  attachSession: boolean;
  sessionPaths: string[];
  reauthPaths: string[];
  signOutPaths: string[];
}

export interface BffConfig {
  basePath: string;
  sameSite: SameSite;
  secureCookies: boolean;
  csrfHeader: string;
  csrfPath: string;
  timeoutMs: number;
  sessionField: string;
  reauthField: string;
  fallbackMaxAgeSeconds: number;
  sessionCookie: string;
  reauthCookie?: string;
  csrfCookie: string;
  allowedOrigins: string[];
  requestHeaders: string[];
  responseHeaders: string[];
  upstreams: Record<string, UpstreamRule>;
}

export interface RawUpstream {
  urlEnv: string;
  attachSession: boolean;
  sessionPaths?: string[];
  reauthPaths?: string[];
  signOutPaths?: string[];
}

export interface RawBffApp {
  basePath: string;
  sessionCookie: string;
  reauthCookie?: string;
  csrfCookie: string;
  allowedOrigins: string[];
  upstreams: Record<string, RawUpstream>;
}

export interface RawBff {
  sameSite: SameSite;
  secureCookies: boolean;
  csrfHeader: string;
  csrfPath: string;
  timeoutMs: number;
  sessionField: string;
  reauthField: string;
  fallbackMaxAgeSeconds: number;
  requestHeaders: string[];
  responseHeaders: string[];
  web?: RawBffApp;
  admin?: RawBffApp;
}

export const BffApp = {
  Web: 'web',
  Admin: 'admin',
} as const;
export type BffApp = (typeof BffApp)[keyof typeof BffApp];

export type Environment = Record<string, string | undefined>;

export function resolveBffConfig(raw: RawBff, app: BffApp, fallbackUrls: Record<string, string>, environment: Environment): BffConfig {
  const section = raw[app];
  if (!section) {
    throw new Error(`BFF settings missing for ${app}`);
  }
  const upstreams = Object.fromEntries(
    Object.entries(section.upstreams).map(([name, rule]) => [
      name,
      {
        baseUrl: (environment[rule.urlEnv]?.trim() || fallbackUrls[name] || '').replace(/\/+$/, ''),
        attachSession: rule.attachSession,
        sessionPaths: rule.sessionPaths ?? [],
        reauthPaths: rule.reauthPaths ?? [],
        signOutPaths: rule.signOutPaths ?? [],
      },
    ]),
  );
  return {
    basePath: section.basePath,
    sameSite: raw.sameSite,
    secureCookies: raw.secureCookies,
    csrfHeader: raw.csrfHeader,
    csrfPath: raw.csrfPath,
    timeoutMs: raw.timeoutMs,
    sessionField: raw.sessionField,
    reauthField: raw.reauthField,
    fallbackMaxAgeSeconds: raw.fallbackMaxAgeSeconds,
    sessionCookie: section.sessionCookie,
    reauthCookie: section.reauthCookie,
    csrfCookie: section.csrfCookie,
    allowedOrigins: section.allowedOrigins,
    requestHeaders: raw.requestHeaders,
    responseHeaders: raw.responseHeaders,
    upstreams,
  };
}
