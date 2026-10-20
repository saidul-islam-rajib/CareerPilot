import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { getAppConfig } from '@/core/config/expo-config';
import { useT } from '@/core/i18n/i18n';
import { AppProviders } from '@/core/providers/app-providers';
import { createAppServices } from '@/core/services/app-services';
import { SessionStatus, useSession } from '@/core/session/session';
import { secureStore } from '@/core/storage/key-value-store';
import { useTheme } from '@/core/theme/theme';

void SplashScreen.preventAutoHideAsync().catch(() => undefined);

function RootNavigator() {
  const { status } = useSession();
  const theme = useTheme();
  const t = useT();

  useEffect(() => {
    if (status !== SessionStatus.Restoring) {
      void SplashScreen.hideAsync().catch(() => undefined);
    }
  }, [status]);

  if (status === SessionStatus.Restoring) {
    return null;
  }

  const signedIn = status === SessionStatus.SignedIn;
  return (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerTintColor: theme.colors.primary,
          headerTitleStyle: { color: theme.colors.text },
          headerStyle: { backgroundColor: theme.colors.background },
          contentStyle: { backgroundColor: theme.colors.surface },
          headerBackTitle: t('common.back'),
        }}
      >
        <Stack.Protected guard={!signedIn}>
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        </Stack.Protected>
        <Stack.Protected guard={signedIn}>
          <Stack.Screen name="(app)" options={{ headerShown: false }} />
        </Stack.Protected>
      </Stack>
    </>
  );
}

export default function RootLayout() {
  const [services] = useState(() => createAppServices(getAppConfig(), secureStore));
  return (
    <AppProviders services={services}>
      <RootNavigator />
    </AppProviders>
  );
}
