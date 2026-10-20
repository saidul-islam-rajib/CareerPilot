import Constants from 'expo-constants';
import { parseAppConfig, type AppConfig } from './app-config';

let cached: AppConfig | undefined;

export function getAppConfig(): AppConfig {
  cached ??= parseAppConfig(Constants.expoConfig?.extra);
  return cached;
}
