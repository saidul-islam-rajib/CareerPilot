import { createHttpApi, createHttpClient, type CareerPilotApi } from '@careerpilot/api-client';
import type { AppConfig } from '../config/client-config';

export interface ApiDependencies {
  config: AppConfig;
  getAccessToken: () => string | undefined;
  onUnauthorized: () => void;
  fetchFn?: typeof fetch;
}

export function createApi(deps: ApiDependencies): CareerPilotApi {
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
