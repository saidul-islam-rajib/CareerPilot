import { QueryClient } from '@tanstack/react-query';
import { ApiErrorCode, isApiError } from '@careerpilot/api-client';
import type { AppConfig } from '../config/client-config';

const RETRYABLE_CODES: ReadonlySet<ApiErrorCode> = new Set([ApiErrorCode.Network, ApiErrorCode.Timeout, ApiErrorCode.Server, ApiErrorCode.ServiceUnavailable]);
const BACKOFF_BASE = 2;

export function isRetryable(error: unknown): boolean {
  return isApiError(error) && RETRYABLE_CODES.has(error.code);
}

export function retryPolicy(maxRetries: number) {
  return (failureCount: number, error: unknown) => failureCount < maxRetries && isRetryable(error);
}

export function backoffDelay(baseMs: number, maxMs: number) {
  return (attempt: number) => Math.min(baseMs * BACKOFF_BASE ** attempt, maxMs);
}

export function createQueryClient(config: AppConfig): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: config.query.staleTimeMs,
        retry: retryPolicy(config.query.retryCount),
        retryDelay: backoffDelay(config.query.retryBaseDelayMs, config.query.retryMaxDelayMs),
      },
      mutations: {
        retry: 0,
      },
    },
  });
}
