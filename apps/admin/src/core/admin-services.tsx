'use client';

import { createContext, useContext, type PropsWithChildren } from 'react';
import {
  buildAdminDemoSeed,
  buildDemoSeed,
  createHttpAdminApi,
  createHttpClient,
  createInMemoryAdminApi,
  sequentialIds,
  systemClock,
  type CareerPilotAdminApi,
  type Clock,
} from '@careerpilot/api-client';
import { ApiMode, createAppServices, type AppServices, type KeyValueStore, type TokenHolder } from '@careerpilot/client-core';
import type { AdminConfig } from './admin-config';

export interface AdminServices {
  config: AdminConfig;
  api: CareerPilotAdminApi;
  store: KeyValueStore;
  clock: Clock;
  tokens: TokenHolder;
  userServices: AppServices;
}

export function createAdminServices(config: AdminConfig, store: KeyValueStore, clock: Clock = systemClock): AdminServices {
  const tokens: TokenHolder = {};
  const userServices = createAppServices(config, store, clock);
  const api =
    config.api.mode === ApiMode.Http
      ? createHttpAdminApi(
          createHttpClient({
            baseUrl: config.admin.baseUrl,
            timeoutMs: config.api.timeoutMs,
            fetchFn: fetch,
            getAccessToken: () => tokens.token,
            onUnauthorized: () => tokens.onUnauthorized?.(),
          }),
        )
      : createInMemoryAdminApi({
          state: buildAdminDemoSeed(clock.now(), buildDemoSeed(clock.now()), config.accountLinks.ttlMinutes),
          userState: buildDemoSeed(clock.now()),
          clock,
          ids: sequentialIds(),
          latencyMs: config.api.demoLatencyMs,
          recentWindowDays: config.account.recentWindowDays,
          chartDays: config.admin.chartDays,
          completeProfilePercent: config.admin.completeProfilePercent,
          linkTtlBounds: { min: config.accountLinks.minTtlMinutes, max: config.accountLinks.maxTtlMinutes },
        });
  return { config, api, store, clock, tokens, userServices };
}

const AdminServicesContext = createContext<AdminServices | undefined>(undefined);

export function AdminServicesProvider({ services, children }: PropsWithChildren<{ services: AdminServices }>) {
  return <AdminServicesContext.Provider value={services}>{children}</AdminServicesContext.Provider>;
}

export function useAdminServices(): AdminServices {
  const services = useContext(AdminServicesContext);
  if (!services) {
    throw new Error('AdminServicesProvider is missing');
  }
  return services;
}

export function useAdminApi(): CareerPilotAdminApi {
  return useAdminServices().api;
}
