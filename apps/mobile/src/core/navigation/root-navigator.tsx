import { useEffect } from 'react';
import { SessionStatus, useSession, useT } from '@careerpilot/client-core';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useTheme } from '@/core/theme/theme';
import { Routes } from './routes';

export function RootNavigator() {
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
        <Stack.Protected guard={!signedIn} redirectTo={Routes.home}>
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        </Stack.Protected>
        <Stack.Protected guard={signedIn} redirectTo={Routes.welcome}>
          <Stack.Screen name="(app)" options={{ headerShown: false }} />
        </Stack.Protected>
      </Stack>
    </>
  );
}
