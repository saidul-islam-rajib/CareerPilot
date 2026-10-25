import {
  buildDemoSeed,
  createHttpApi,
  createHttpClient,
  createInMemoryApi,
  systemClock,
  sequentialIds,
  type CareerPilotApi,
  type Clock,
} from '@careerpilot/api-client';
import { ApiMode, publicConfigFromDefaults, type AppConfig } from '../config/client-config';

export interface ApiDependencies {
  config: AppConfig;
  getAccessToken: () => string | undefined;
  onUnauthorized: () => void;
  fetchFn?: typeof fetch;
  clock?: Clock;
}

export function createApi(deps: ApiDependencies): CareerPilotApi {
  const clock = deps.clock ?? systemClock;
  if (deps.config.api.mode === ApiMode.Http) {
    return createHttpApi(
      createHttpClient({
        baseUrl: deps.config.api.baseUrl,
        timeoutMs: deps.config.api.timeoutMs,
        uploadTimeoutMs: deps.config.api.uploadTimeoutMs,
        fetchFn: deps.fetchFn ?? fetch,
        getAccessToken: deps.getAccessToken,
        onUnauthorized: deps.onUnauthorized,
      }),
    );
  }
  return createInMemoryApi({
    config: publicConfigFromDefaults(deps.config),
    state: buildDemoSeed(clock.now()),
    clock,
    ids: sequentialIds(),
    latencyMs: deps.config.api.demoLatencyMs,
    approvalValidityDays: deps.config.account.approvalValidityDays,
    recentWindowDays: deps.config.account.recentWindowDays,
  });
}
