import { useState, type ReactElement, type ReactNode } from 'react';
import { type AppConfig, type AppServices, createAppServices, createMemoryStore, parseAppConfig, publicConfigFromDefaults, queryKeys } from '@careerpilot/client-core';
import { QueryClient } from '@tanstack/react-query';
import { render, type RenderResult } from '@testing-library/react-native';
import type { Clock, Session } from '@careerpilot/api-client';
import { AppProviders } from '@/core/providers/app-providers';

const { loadClientConfig } = require('../../../../scripts/config/load-config') as { loadClientConfig: (env: string) => Record<string, unknown> };

export const testNow = new Date('2026-10-20T06:00:00Z');
export const testClock: Clock = { now: () => new Date(testNow) };

export function testConfig(): AppConfig {
  const config = parseAppConfig({ careerpilot: loadClientConfig('local') });
  return { ...config, api: { ...config.api, demoLatencyMs: 0 } };
}

export const testWindowMetrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

export const demoSession: Session = {
  accessToken: 'test-token',
  user: { id: 'usr_demo', fullName: 'Ayesha Rahman', email: 'admin@sober.com' },
};

export interface RenderOptions {
  signedIn?: boolean;
  services?: AppServices;
  bottomInset?: number;
}

export interface RenderWithServices extends RenderResult {
  services: AppServices;
}

export function createTestServices(signedIn = true): AppServices {
  const store = createMemoryStore(signedIn ? { 'careerpilot.session': JSON.stringify(demoSession) } : {});
  return createAppServices(testConfig(), store, testClock);
}

function createTestQueryClient(services: AppServices): QueryClient {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false } } });
  queryClient.setQueryData(queryKeys.config, publicConfigFromDefaults(services.config));
  return queryClient;
}

export function TestProviders({ services, bottomInset = 0, children }: { services: AppServices; bottomInset?: number; children: ReactNode }) {
  const [queryClient] = useState(() => createTestQueryClient(services));
  const metrics = { ...testWindowMetrics, insets: { ...testWindowMetrics.insets, bottom: bottomInset } };
  return (
    <AppProviders services={services} queryClient={queryClient} safeAreaMetrics={metrics}>
      {children}
    </AppProviders>
  );
}

export async function renderWithProviders(ui: ReactElement, options: RenderOptions = {}): Promise<RenderWithServices> {
  const services = options.services ?? createTestServices(options.signedIn !== false);
  const result = await render(
    <TestProviders services={services} bottomInset={options.bottomInset}>
      {ui}
    </TestProviders>,
  );
  return Object.assign(result, { services });
}

export const mockRouter = (globalThis as unknown as { mockRouter: { push: jest.Mock; replace: jest.Mock; back: jest.Mock } }).mockRouter;
export const mockParams = (globalThis as unknown as { mockParams: { current: Record<string, string> } }).mockParams;
