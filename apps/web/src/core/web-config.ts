import { parseAppConfig, type AppConfig } from '@careerpilot/client-core';

let cached: AppConfig | undefined;

export function getWebConfig(): AppConfig {
  cached ??= parseAppConfig({ careerpilot: JSON.parse(process.env.NEXT_PUBLIC_CAREERPILOT_CONFIG ?? '{}') });
  return cached;
}
