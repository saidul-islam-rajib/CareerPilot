import type { ConfigContext, ExpoConfig } from 'expo/config';
const { loadConfig } = require('./config-loader') as { loadConfig: (env: string) => Record<string, unknown> };

const APP_ENV = process.env.APP_ENV ?? 'local';

interface MobileSection {
  appName: string;
  slug: string;
  scheme: string;
  androidPackage: string;
  iosBundleIdentifier: string;
  version: string;
}

export default ({ config }: ConfigContext): ExpoConfig => {
  const settings = loadConfig(APP_ENV);
  const mobile = settings.mobile as unknown as MobileSection;
  return {
    ...config,
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
    },
    android: {
      package: mobile.androidPackage,
      adaptiveIcon: {
        backgroundColor: '#0F766E',
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
      careerpilot: settings,
    },
  };
};
