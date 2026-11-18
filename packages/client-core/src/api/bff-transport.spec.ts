import { describe, expect, it } from 'vitest';
import { createBffTransport } from './bff-transport';
import type { AppConfig } from '../config/client-config';

const bff = {
  sameSite: 'lax',
  secureCookies: false,
  csrfHeader: 'X-CSRF-Token',
  csrfPath: 'csrf',
  timeoutMs: 1,
  sessionField: 'accessToken',
  reauthField: 'reauthToken',
  fallbackMaxAgeSeconds: 1,
  requestHeaders: [],
  responseHeaders: [],
  web: { basePath: '/api/bff/', sessionCookie: 's', csrfCookie: 'c', allowedOrigins: [], upstreams: {} },
};

describe('createBffTransport', () => {
  it('builds a same-origin transport from config', () => {
    const transport = createBffTransport({ bff } as unknown as AppConfig, 'web', 'user');
    expect(transport?.baseUrl()).toBe('/api/bff/user');
  });

  it('is absent without settings for the app', () => {
    expect(createBffTransport({ bff } as unknown as AppConfig, 'admin', 'admin')).toBeUndefined();
    expect(createBffTransport({} as unknown as AppConfig, 'web', 'user')).toBeUndefined();
  });
});
