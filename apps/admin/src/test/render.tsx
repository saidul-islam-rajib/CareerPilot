import { createRequire } from 'node:module';
import type { ReactElement } from 'react';
import { QueryClient } from '@tanstack/react-query';
import { render, type RenderResult } from '@testing-library/react';
import type { Mock } from 'vitest';
import { buildAdminDemoSeed, buildDemoSeed, createInMemoryAdminApi, sequentialIds, type AdminSession, type Clock, type NewSource } from '@careerpilot/api-client';
import { createMemoryStore, publicConfigFromDefaults, queryKeys } from '@careerpilot/client-core';
import { TEST_LINK_TOKEN, createTestApi } from '@careerpilot/client-core/src/testing';
import { parseAdminConfig, type AdminConfig } from '@/core/admin-config';
import { createAdminServices, type AdminApis, type AdminServices } from '@/core/admin-services';
import { Providers } from '@/core/providers';

const require = createRequire(import.meta.url);
const { loadClientConfig, loadConfig } = require('../../../../scripts/config/load-config.js') as {
  loadClientConfig: (env: string) => Record<string, unknown>;
  loadConfig: (env: string) => { discovery: { suggestedSources: NewSource[] } };
};

export const suggestedSources = loadConfig('local').discovery.suggestedSources;

export const testNow = new Date('2026-10-20T06:00:00Z');
const testClock: Clock = { now: () => new Date(testNow) };

export function testConfig(): AdminConfig {
  return parseAdminConfig(loadClientConfig('local'));
}

export function testApis(config: AdminConfig, clock: Clock): AdminApis {
  const userState = buildDemoSeed(clock.now());
  return {
    user: createTestApi(config, clock),
    admin: createInMemoryAdminApi({
      state: buildAdminDemoSeed(clock.now(), userState, config.accountLinks.ttlMinutes),
      userState,
      clock,
      ids: sequentialIds(),
      latencyMs: 0,
      recentWindowDays: config.account.recentWindowDays,
      chartDays: config.admin.chartDays,
      completeProfilePercent: config.admin.completeProfilePercent,
      linkTtlBounds: { min: config.accountLinks.minTtlMinutes, max: config.accountLinks.maxTtlMinutes },
      linkToken: TEST_LINK_TOKEN,
      suggestedSources,
    }),
  };
}

export interface Navigation {
  push: Mock;
  replace: Mock;
  back: Mock;
  params: Record<string, string>;
  search: string;
  pathname: string;
}

export const navigation = (globalThis as unknown as { navigation: Navigation }).navigation;

export async function adminSession(services: AdminServices, email = 'admin@sober.com'): Promise<AdminSession> {
  return services.api.auth.signIn({ email, password: 'admin@sober.com' });
}

export async function renderAdmin(
  ui: ReactElement,
  options: { email?: string; signedIn?: boolean; params?: Record<string, string>; search?: string; prepare?: (services: AdminServices) => Promise<unknown> } = {},
): Promise<RenderResult & { services: AdminServices }> {
  navigation.params = options.params ?? {};
  navigation.search = options.search ?? '';
  const store = createMemoryStore();
  const config = testConfig();
  const services = createAdminServices(config, store, testClock, testApis(config, testClock));
  if (options.signedIn !== false) {
    const session = await adminSession(services, options.email);
    await store.set('careerpilot.admin.session', JSON.stringify(session));
  }
  await options.prepare?.(services);
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false } } });
  queryClient.setQueryData(queryKeys.config, publicConfigFromDefaults(services.config));
  const result = render(
    <Providers services={services} queryClient={queryClient}>
      {ui}
    </Providers>,
  );
  return Object.assign(result, { services });
}
