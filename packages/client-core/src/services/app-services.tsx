import { createContext, useContext, type PropsWithChildren } from 'react';
import { systemClock, type CareerPilotApi, type Clock } from '@careerpilot/api-client';
import { createApi } from '../api/create-api';
import type { AppConfig } from '../config/client-config';
import type { KeyValueStore } from '../storage/key-value-store';

export interface TokenHolder {
  token?: string;
  onUnauthorized?: () => void;
}

export interface AppServices {
  config: AppConfig;
  api: CareerPilotApi;
  store: KeyValueStore;
  clock: Clock;
  tokens: TokenHolder;
}

export function createAppServices(config: AppConfig, store: KeyValueStore, clock: Clock = systemClock, api?: CareerPilotApi): AppServices {
  const tokens: TokenHolder = {};
  const connected =
    api ??
    createApi({
      config,
      getAccessToken: () => tokens.token,
      onUnauthorized: () => tokens.onUnauthorized?.(),
    });
  return { config, api: connected, store, clock, tokens };
}

const AppServicesContext = createContext<AppServices | undefined>(undefined);

export function AppServicesProvider({ services, children }: PropsWithChildren<{ services: AppServices }>) {
  return <AppServicesContext.Provider value={services}>{children}</AppServicesContext.Provider>;
}

export function useServices(): AppServices {
  const services = useContext(AppServicesContext);
  if (!services) {
    throw new Error('AppServicesProvider is missing');
  }
  return services;
}

export function useApi(): CareerPilotApi {
  return useServices().api;
}
