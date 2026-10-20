import type { ReactElement } from 'react';
import { QueryClient } from '@tanstack/react-query';
import { render, type RenderResult } from '@testing-library/react-native';
import type { Clock, Session } from '@careerpilot/api-client';
import { parseAppConfig, type AppConfig } from '@/core/config/app-config';
import { AppProviders } from '@/core/providers/app-providers';
import { createAppServices, type AppServices } from '@/core/services/app-services';
import { createMemoryStore } from '@/core/storage/memory-store';

const { loadConfig } = require('../../config-loader') as { loadConfig: (env: string) => Record<string, unknown> };

export const testNow = new Date('2026-10-20T06:00:00Z');
export const testClock: Clock = { now: () => new Date(testNow) };

export function testConfig(): AppConfig {
  const config = parseAppConfig({ careerpilot: loadConfig('local') });
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
}

export interface RenderWithServices extends RenderResult {
  services: AppServices;
}

export function renderWithProviders(ui: ReactElement, options: RenderOptions = {}): RenderWithServices {
  const store = createMemoryStore(options.signedIn === false ? {} : { 'careerpilot.session': JSON.stringify(demoSession) });
  const services = options.services ?? createAppServices(testConfig(), store, testClock);
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false } } });
  const result = render(
    <AppProviders services={services} queryClient={queryClient} safeAreaMetrics={testWindowMetrics}>
      {ui}
    </AppProviders>,
  );
  return Object.assign(result, { services });
}

export const mockRouter = (globalThis as unknown as { mockRouter: { push: jest.Mock; replace: jest.Mock; back: jest.Mock } }).mockRouter;
export const mockParams = (globalThis as unknown as { mockParams: { current: Record<string, string> } }).mockParams;
