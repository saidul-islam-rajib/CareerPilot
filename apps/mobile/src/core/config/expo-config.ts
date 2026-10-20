import Constants from 'expo-constants';
import { parseAppConfig, type AppConfig } from '@careerpilot/client-core';

let cached: AppConfig | undefined;

export function getAppConfig(): AppConfig {
  cached ??= parseAppConfig(Constants.expoConfig?.extra);
  return cached;
}

export function getAppVersion(): string {
  return Constants.expoConfig?.version ?? '';
}
