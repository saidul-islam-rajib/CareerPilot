'use client';

import { createContext, useContext, type PropsWithChildren } from 'react';
import { createHttpAdminApi, createHttpClient, systemClock, type CareerPilotAdminApi, type CareerPilotApi, type Clock } from '@careerpilot/api-client';
import { createAppServices, type AppServices, type KeyValueStore, type TokenHolder } from '@careerpilot/client-core';
import type { AdminConfig } from './admin-config';

export interface AdminServices {
  config: AdminConfig;
  api: CareerPilotAdminApi;
  store: KeyValueStore;
  clock: Clock;
  tokens: TokenHolder;
  userServices: AppServices;
}

export interface AdminApis {
  admin: CareerPilotAdminApi;
  user: CareerPilotApi;
}

function httpAdminApi(config: AdminConfig, tokens: TokenHolder): CareerPilotAdminApi {
  return createHttpAdminApi(
    createHttpClient({
      baseUrl: config.admin.baseUrl,
      timeoutMs: config.api.timeoutMs,
      fetchFn: fetch,
      getAccessToken: () => tokens.token,
      onUnauthorized: () => tokens.onUnauthorized?.(),
    }),
  );
}

export function createAdminServices(config: AdminConfig, store: KeyValueStore, clock: Clock = systemClock, apis?: AdminApis): AdminServices {
  const tokens: TokenHolder = {};
  const userServices = createAppServices(config, store, clock, apis?.user);
  const api = apis?.admin ?? httpAdminApi(config, tokens);
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
