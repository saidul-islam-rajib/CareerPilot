import { BffApp, createBffRouteHandlers, resolveBffConfig } from '@careerpilot/api-client';
import { getWebConfig } from '@/core/web-config';

export const dynamic = 'force-dynamic';

function webBffConfig() {
  const config = getWebConfig();
  if (!config.bff) {
    throw new Error('BFF settings are missing');
  }
  return resolveBffConfig(config.bff, BffApp.Web, { user: config.api.baseUrl }, process.env);
}

export const { GET, HEAD, POST, PUT, PATCH, DELETE } = createBffRouteHandlers(webBffConfig);
