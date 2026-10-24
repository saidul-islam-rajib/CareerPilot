import { createRequire } from 'node:module';
import type { ReactElement } from 'react';
import { QueryClient } from '@tanstack/react-query';
import { render, type RenderResult } from '@testing-library/react';
import type { Mock } from 'vitest';
import type { AdminSession, Clock } from '@careerpilot/api-client';
import { createMemoryStore, publicConfigFromDefaults, queryKeys } from '@careerpilot/client-core';
import { parseAdminConfig, type AdminConfig } from '@/core/admin-config';
import { createAdminServices, type AdminServices } from '@/core/admin-services';
import { Providers } from '@/core/providers';

const require = createRequire(import.meta.url);
const { loadConfig } = require('../../../../scripts/config/load-config.js') as { loadConfig: (env: string) => Record<string, unknown> };

export const testNow = new Date('2026-10-20T06:00:00Z');
const testClock: Clock = { now: () => new Date(testNow) };

export function testConfig(): AdminConfig {
  const config = parseAdminConfig(loadConfig('local'));
  return { ...config, api: { ...config.api, demoLatencyMs: 0 } };
}

export interface Navigation {
  push: Mock;
  replace: Mock;
  back: Mock;
  params: Record<string, string>;
  pathname: string;
}

export const navigation = (globalThis as unknown as { navigation: Navigation }).navigation;

export async function adminSession(services: AdminServices, email = 'admin@sober.com'): Promise<AdminSession> {
  return services.api.auth.signIn({ email, password: 'admin@sober.com' });
}

export async function renderAdmin(ui: ReactElement, options: { email?: string; signedIn?: boolean; params?: Record<string, string> } = {}): Promise<RenderResult & { services: AdminServices }> {
  navigation.params = options.params ?? {};
  const store = createMemoryStore();
  const services = createAdminServices(testConfig(), store, testClock);
  if (options.signedIn !== false) {
    const session = await adminSession(services, options.email);
    await store.set('careerpilot.admin.session', JSON.stringify(session));
  }
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false } } });
  queryClient.setQueryData(queryKeys.config, publicConfigFromDefaults(services.config));
  const result = render(
    <Providers services={services} queryClient={queryClient}>
      {ui}
    </Providers>,
  );
  return Object.assign(result, { services });
}
