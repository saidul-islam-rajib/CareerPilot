import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { ConfigContext, ExpoConfig } from 'expo/config';
const { loadConfig, clientConfig } = require('../../scripts/config/load-config') as {
  loadConfig: (env: string) => Record<string, unknown>;
  clientConfig: (config: Record<string, unknown>) => Record<string, unknown>;
};

const catalog = require('../../packages/i18n/src/locales/en.json') as { profile: { photoPermission: string }; messaging: { microphonePermission: string } };

const APP_ENV = process.env.APP_ENV ?? 'local';
const API_URL = process.env.CAREERPILOT_API_URL;
const INSECURE_SCHEME = 'http://';
const BRAND_COLOR = '#0F766E';
const LOCAL_GOOGLE_SERVICES = './google-services.json';
const NOTIFICATION_ICON = './assets/images/android-icon-monochrome.png';

function googleServicesFile(): string | undefined {
  return process.env.GOOGLE_SERVICES_JSON ?? (existsSync(join(__dirname, LOCAL_GOOGLE_SERVICES)) ? LOCAL_GOOGLE_SERVICES : undefined);
}

function withApiUrl(settings: Record<string, unknown>, url: string | undefined): Record<string, unknown> {
  return url ? { ...settings, api: { ...(settings.api as Record<string, unknown>), baseUrl: url } } : settings;
}

interface PushSection {
  channelId: string;
}

interface MobileSection {
  appName: string;
  slug: string;
  scheme: string;
  androidPackage: string;
  iosBundleIdentifier: string;
  version: string;
  expoOwner: string;
  easProjectId: string;
}

function usesPlainHttp(settings: Record<string, unknown>): boolean {
  const api = settings.api as { baseUrl?: string } | undefined;
  return String(api?.baseUrl ?? '').startsWith(INSECURE_SCHEME);
}

export default ({ config }: ConfigContext): ExpoConfig => {
  const settings = withApiUrl(loadConfig(APP_ENV), API_URL);
  const mobile = settings.mobile as unknown as MobileSection;
  const plainHttp = usesPlainHttp(settings);
  const push = (settings.messaging as { push: PushSection }).push;
  return {
    ...config,
    owner: mobile.expoOwner,
    name: mobile.appName,
    slug: mobile.slug,
    scheme: mobile.scheme,
    version: mobile.version,
    orientation: 'default',
    icon: './assets/images/icon.png',
    userInterfaceStyle: 'light',
    ios: {
      bundleIdentifier: mobile.iosBundleIdentifier,
      supportsTablet: true,
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false,
        ...(plainHttp ? { NSAppTransportSecurity: { NSAllowsArbitraryLoads: true } } : {}),
      },
    },
    android: {
      package: mobile.androidPackage,
      googleServicesFile: googleServicesFile(),
      adaptiveIcon: {
        backgroundColor: BRAND_COLOR,
        foregroundImage: './assets/images/android-icon-foreground.png',
        backgroundImage: './assets/images/android-icon-background.png',
        monochromeImage: './assets/images/android-icon-monochrome.png',
      },
      predictiveBackGestureEnabled: false,
    },
    web: {
      output: 'single',
      favicon: './assets/images/favicon.png',
    },
    plugins: [
      'expo-router',
      'expo-secure-store',
      ['expo-image-picker', { photosPermission: catalog.profile.photoPermission, cameraPermission: false, microphonePermission: catalog.messaging.microphonePermission }],
      'expo-document-picker',
      ['expo-audio', { microphonePermission: catalog.messaging.microphonePermission, enableBackgroundPlayback: false }],
      ['expo-notifications', { icon: NOTIFICATION_ICON, color: BRAND_COLOR, defaultChannel: push.channelId }],
      ['expo-build-properties', { android: { usesCleartextTraffic: plainHttp } }],
      [
        'expo-splash-screen',
        {
          backgroundColor: '#FFFFFF',
          image: './assets/images/splash-icon.png',
          imageWidth: 120,
        },
      ],
    ],
    experiments: {
      typedRoutes: true,
      reactCompiler: true,
    },
    extra: {
      appEnv: APP_ENV,
      careerpilot: clientConfig(settings),
      eas: { projectId: mobile.easProjectId },
    },
  };
};
