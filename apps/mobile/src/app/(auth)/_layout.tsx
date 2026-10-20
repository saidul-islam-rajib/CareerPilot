import { Stack } from 'expo-router';
import { useT } from '@/core/i18n/i18n';
import { useTheme } from '@/core/theme/theme';

export const unstable_settings = { initialRouteName: 'welcome' };

export default function AuthLayout() {
  const t = useT();
  const theme = useTheme();
  return (
    <Stack
      screenOptions={{
        headerTintColor: theme.colors.primary,
        headerTitleStyle: { color: theme.colors.text },
        headerStyle: { backgroundColor: theme.colors.background },
        contentStyle: { backgroundColor: theme.colors.surface },
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen name="welcome" options={{ headerShown: false }} />
      <Stack.Screen name="sign-in" options={{ title: t('auth.signIn') }} />
      <Stack.Screen name="register" options={{ title: t('auth.createAccount') }} />
      <Stack.Screen name="forgot-password" options={{ title: t('auth.resetTitle') }} />
    </Stack>
  );
}
