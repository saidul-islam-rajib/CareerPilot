import { createRequire } from 'node:module';
import type { ReactElement } from 'react';
import { QueryClient } from '@tanstack/react-query';
import { render, type RenderResult } from '@testing-library/react';
import type { Mock } from 'vitest';
import type { Clock, Session } from '@careerpilot/api-client';
import { createAppServices, createMemoryStore, parseAppConfig, publicConfigFromDefaults, queryKeys, type AppConfig, type AppServices } from '@careerpilot/client-core';
import { Providers } from '@/core/providers';

const require = createRequire(import.meta.url);
const { loadClientConfig } = require('../../../../scripts/config/load-config.js') as { loadClientConfig: (env: string) => Record<string, unknown> };

export const testNow = new Date('2026-10-20T06:00:00Z');
const DAY_MS = 86_400_000;

export function testConfig(): AppConfig {
  const config = parseAppConfig({ careerpilot: loadClientConfig('local') });
  return { ...config, api: { ...config.api, demoLatencyMs: 0 } };
}

export const demoSession: Session = {
  accessToken: 'test-token',
  user: { id: 'usr_demo', fullName: 'Ayesha Rahman', email: 'admin@sober.com' },
};

export function createSignedOutServices(): AppServices {
  return createAppServices(testConfig(), createMemoryStore({}), { now: () => new Date(testNow) });
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

export function renderWithProviders(
  ui: ReactElement,
  options: { signedIn?: boolean; params?: Record<string, string>; search?: string; laterByDays?: number; services?: AppServices } = {},
): RenderResult & { services: AppServices } {
  navigation.params = options.params ?? {};
  navigation.search = options.search ?? '';
  const store = createMemoryStore(options.signedIn === false ? {} : { 'careerpilot.session': JSON.stringify(demoSession) });
  let offset = 0;
  const clock: Clock = { now: () => new Date(testNow.getTime() + offset) };
  const services = options.services ?? createAppServices(testConfig(), store, clock);
  offset = (options.laterByDays ?? 0) * DAY_MS;
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false } } });
  queryClient.setQueryData(queryKeys.config, publicConfigFromDefaults(services.config));
  const result = render(
    <Providers services={services} queryClient={queryClient}>
      {ui}
    </Providers>,
  );
  return Object.assign(result, { services });
}
