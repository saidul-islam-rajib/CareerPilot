import { useState } from 'react';
import { createAppServices } from '@careerpilot/client-core';
import * as SplashScreen from 'expo-splash-screen';
import { getAppConfig } from '@/core/config/expo-config';
import { RootNavigator } from '@/core/navigation/root-navigator';
import { AppProviders } from '@/core/providers/app-providers';
import { secureStore } from '@/core/storage/key-value-store';

void SplashScreen.preventAutoHideAsync().catch(() => undefined);

export default function RootLayout() {
  const [services] = useState(() => createAppServices(getAppConfig(), secureStore));
  return (
    <AppProviders services={services}>
      <RootNavigator />
    </AppProviders>
  );
}
