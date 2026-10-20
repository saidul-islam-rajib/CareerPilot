import { QueryClient } from '@tanstack/react-query';
import type { AppConfig } from '../config/client-config';

export function createQueryClient(config: AppConfig): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: config.query.staleTimeMs,
        retry: config.query.retryCount,
      },
      mutations: {
        retry: 0,
      },
    },
  });
}
