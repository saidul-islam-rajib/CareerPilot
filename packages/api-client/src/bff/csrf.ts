const TOKEN_BYTES = 32;
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const CROSS_SITE = 'cross-site';

export function isSafeMethod(method: string): boolean {
  return SAFE_METHODS.has(method.toUpperCase());
}

export function newCsrfToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(TOKEN_BYTES));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function tokensMatch(expected: string | undefined, actual: string | null): boolean {
  if (!expected || !actual || expected.length !== actual.length) {
    return false;
  }
  let difference = 0;
  for (let index = 0; index < expected.length; index += 1) {
    difference |= expected.charCodeAt(index) ^ actual.charCodeAt(index);
  }
  return difference === 0;
}

export function requestOrigin(headers: Headers, requestUrl: string): string {
  const url = new URL(requestUrl);
  const protocol = headers.get('x-forwarded-proto')?.split(',')[0]?.trim() || url.protocol.replace(':', '');
  const host = headers.get('x-forwarded-host')?.split(',')[0]?.trim() || headers.get('host') || url.host;
  return `${protocol}://${host}`;
}

export function originAllowed(headers: Headers, requestUrl: string, allowedOrigins: string[]): boolean {
  if (headers.get('sec-fetch-site') === CROSS_SITE) {
    return false;
  }
  const origin = headers.get('origin');
  if (!origin) {
    return false;
  }
  return origin === requestOrigin(headers, requestUrl) || allowedOrigins.includes(origin);
}
