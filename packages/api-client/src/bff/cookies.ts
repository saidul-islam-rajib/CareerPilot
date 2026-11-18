import type { SameSite } from './config';

export interface CookieOptions {
  httpOnly: boolean;
  secure: boolean;
  sameSite: SameSite;
  maxAgeSeconds?: number;
}

const SAME_SITE_LABEL: Record<SameSite, string> = { lax: 'Lax', strict: 'Strict' };

export function readCookies(header: string | null): Record<string, string> {
  const result: Record<string, string> = {};
  for (const part of (header ?? '').split(';')) {
    const index = part.indexOf('=');
    if (index > 0) {
      const name = part.slice(0, index).trim();
      const value = part.slice(index + 1).trim();
      try {
        result[name] = decodeURIComponent(value);
      } catch {
        result[name] = value;
      }
    }
  }
  return result;
}

export function serializeCookie(name: string, value: string, options: CookieOptions): string {
  const parts = [`${name}=${encodeURIComponent(value)}`, 'Path=/', `SameSite=${SAME_SITE_LABEL[options.sameSite]}`];
  if (options.httpOnly) {
    parts.push('HttpOnly');
  }
  if (options.secure) {
    parts.push('Secure');
  }
  if (options.maxAgeSeconds !== undefined) {
    parts.push(`Max-Age=${Math.max(0, Math.floor(options.maxAgeSeconds))}`);
  }
  return parts.join('; ');
}

export function expireCookie(name: string, options: Omit<CookieOptions, 'maxAgeSeconds'>): string {
  return serializeCookie(name, '', { ...options, maxAgeSeconds: 0 });
}
