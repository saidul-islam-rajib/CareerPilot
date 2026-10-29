import { createContext, useContext, type PropsWithChildren } from 'react';
import { systemClock, type CareerPilotApi, type Clock } from '@careerpilot/api-client';
import { createApi } from '../api/create-api';
import type { AppConfig } from '../config/client-config';
import type { KeyValueStore } from '../storage/key-value-store';
import { createServerAddress, serverAnswers, type ServerAddress } from './server-address';

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
  server: ServerAddress;
  probeServer: (address: string) => Promise<boolean>;
}

export function createAppServices(config: AppConfig, store: KeyValueStore, clock: Clock = systemClock, api?: CareerPilotApi): AppServices {
  const tokens: TokenHolder = {};
  const server = createServerAddress(config.api.baseUrl);
  const connected =
    api ??
    createApi({
      config,
      baseUrl: server.current,
      getAccessToken: () => tokens.token,
      onUnauthorized: () => tokens.onUnauthorized?.(),
    });
  const probeServer = (address: string) => serverAnswers(address, config.api.timeoutMs);
  return { config, api: connected, store, clock, tokens, server, probeServer };
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
