export interface BffFetchOptions {
  csrfHeader: string;
  csrfCookie: string;
  csrfUrl: string;
  readCookie: (name: string) => string | undefined;
  fetchFn?: typeof fetch;
}

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export function browserCookie(name: string): string | undefined {
  if (typeof document === 'undefined') {
    return undefined;
  }
  const prefix = `${name}=`;
  const found = document.cookie
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix));
  return found ? decodeURIComponent(found.slice(prefix.length)) : undefined;
}

export function createBffFetch(options: BffFetchOptions): typeof fetch {
  const base: typeof fetch = options.fetchFn ?? ((...args) => fetch(...args));
  async function ensureToken(): Promise<string | undefined> {
    const existing = options.readCookie(options.csrfCookie);
    if (existing) {
      return existing;
    }
    await base(options.csrfUrl, { credentials: 'same-origin' });
    return options.readCookie(options.csrfCookie);
  }
  return async (input, init) => {
    const method = (init?.method ?? 'GET').toUpperCase();
    const headers = new Headers(init?.headers);
    if (!SAFE_METHODS.has(method)) {
      const token = await ensureToken();
      if (token) {
        headers.set(options.csrfHeader, token);
      }
    }
    return base(input, { ...init, headers, credentials: 'same-origin' });
  };
}
