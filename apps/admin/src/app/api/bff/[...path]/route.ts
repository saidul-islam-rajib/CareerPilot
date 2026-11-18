import { BffApp, createBffRouteHandlers, resolveBffConfig } from '@careerpilot/api-client';
import { getAdminConfig } from '@/core/admin-config';

export const dynamic = 'force-dynamic';

function adminBffConfig() {
  const config = getAdminConfig();
  if (!config.bff) {
    throw new Error('BFF settings are missing');
  }
  return resolveBffConfig(config.bff, BffApp.Admin, { admin: config.admin.baseUrl, user: config.api.baseUrl }, process.env);
}

export const { GET, HEAD, POST, PUT, PATCH, DELETE } = createBffRouteHandlers(adminBffConfig);
