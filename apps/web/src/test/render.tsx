import { createRequire } from 'node:module';
import type { ReactElement } from 'react';
import { QueryClient } from '@tanstack/react-query';
import { render, type RenderResult } from '@testing-library/react';
import type { Mock } from 'vitest';
import type { Clock, Session } from '@careerpilot/api-client';
import { createAppServices, createMemoryStore, parseAppConfig, publicConfigFromDefaults, queryKeys, type AppConfig, type AppServices } from '@careerpilot/client-core';
import { Providers } from '@/core/providers';

const require = createRequire(import.meta.url);
const { loadConfig } = require('../../../../scripts/config/load-config.js') as { loadConfig: (env: string) => Record<string, unknown> };

export const testNow = new Date('2026-10-20T06:00:00Z');
const testClock: Clock = { now: () => new Date(testNow) };

export function testConfig(): AppConfig {
  const config = parseAppConfig({ careerpilot: loadConfig('local') });
  return { ...config, api: { ...config.api, demoLatencyMs: 0 } };
}

export const demoSession: Session = {
  accessToken: 'test-token',
  user: { id: 'usr_demo', fullName: 'Ayesha Rahman', email: 'admin@sober.com' },
};

export interface Navigation {
  push: Mock;
  replace: Mock;
  back: Mock;
  params: Record<string, string>;
  pathname: string;
}

export const navigation = (globalThis as unknown as { navigation: Navigation }).navigation;

export function renderWithProviders(ui: ReactElement, options: { signedIn?: boolean; params?: Record<string, string> } = {}): RenderResult & { services: AppServices } {
  navigation.params = options.params ?? {};
  const store = createMemoryStore(options.signedIn === false ? {} : { 'careerpilot.session': JSON.stringify(demoSession) });
  const services = createAppServices(testConfig(), store, testClock);
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false } } });
  queryClient.setQueryData(queryKeys.config, publicConfigFromDefaults(services.config));
  const result = render(
    <Providers services={services} queryClient={queryClient}>
      {ui}
    </Providers>,
  );
  return Object.assign(result, { services });
}
