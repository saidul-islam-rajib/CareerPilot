import { BffApp, browserCookie, createBffFetch } from '@careerpilot/api-client';
import type { AppConfig } from '../config/client-config';

export interface BffTransport {
  baseUrl: () => string;
  fetchFn: typeof fetch;
}

export function createBffTransport(config: AppConfig, app: BffApp, upstream: string): BffTransport | undefined {
  const section = config.bff?.[app];
  if (!config.bff || !section) {
    return undefined;
  }
  const root = section.basePath.replace(/\/+$/, '');
  return {
    baseUrl: () => `${root}/${upstream}`,
    fetchFn: createBffFetch({
      csrfHeader: config.bff.csrfHeader,
      csrfCookie: section.csrfCookie,
      csrfUrl: `${root}/${config.bff.csrfPath}`,
      readCookie: browserCookie,
    }),
  };
}
