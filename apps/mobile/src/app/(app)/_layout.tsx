import { Stack } from 'expo-router';
import { useT } from '@careerpilot/client-core';
import { useTheme } from '@/core/theme/theme';

export default function SignedInLayout() {
  const t = useT();
  const theme = useTheme();
  return (
    <Stack
      screenOptions={{
        headerTintColor: theme.colors.primary,
        headerTitleStyle: { color: theme.colors.text },
        headerStyle: { backgroundColor: theme.colors.background },
        contentStyle: { backgroundColor: theme.colors.surface },
        headerBackTitle: t('common.back'),
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="opportunity/[id]" options={{ title: '' }} />
      <Stack.Screen name="approval/[id]" options={{ title: t('approvals.title') }} />
      <Stack.Screen name="application/[id]" options={{ title: t('applications.record') }} />
      <Stack.Screen name="follow-up" options={{ title: t('applications.followUps') }} />
      <Stack.Screen name="outcome" options={{ title: t('applications.updateOutcome') }} />
      <Stack.Screen name="circular/[opportunityId]" options={{ title: t('applications.circular'), presentation: 'modal' }} />
      <Stack.Screen name="viewer" options={{ headerShown: false, presentation: 'fullScreenModal', animation: 'fade' }} />
      <Stack.Screen name="profile/basics" options={{ title: t('profile.editBasics') }} />
      <Stack.Screen name="profile/photo" options={{ title: t('profile.adjustPhoto') }} />
      <Stack.Screen name="profile/verify-contact" options={{ title: t('verification.title') }} />
      <Stack.Screen name="profile/contact" options={{ title: t('profile.contacts') }} />
      <Stack.Screen name="profile/entry" options={{ title: t('profile.title') }} />
      <Stack.Screen name="profile/skills" options={{ title: t('profile.editSkills') }} />
      <Stack.Screen name="profile/document" options={{ title: t('profile.documents') }} />
      <Stack.Screen name="settings/tracks" options={{ title: t('settings.tracks') }} />
      <Stack.Screen name="settings/pause" options={{ title: t('settings.pause') }} />
      <Stack.Screen name="settings/window" options={{ title: t('settings.submissionWindow') }} />
      <Stack.Screen name="settings/notifications" options={{ title: t('settings.notifications') }} />
      <Stack.Screen name="settings/answers" options={{ title: t('answers.title') }} />
      <Stack.Screen name="settings/answer" options={{ title: t('answers.edit') }} />
      <Stack.Screen name="settings/password" options={{ title: t('settings.changePassword') }} />
      <Stack.Screen name="settings/activity" options={{ title: t('activity.title') }} />
      <Stack.Screen name="settings/about" options={{ title: t('settings.about') }} />
      <Stack.Screen name="settings/licences" options={{ title: t('settings.licences') }} />
      <Stack.Screen name="settings/delete-account" options={{ title: t('settings.deleteAccount') }} />
    </Stack>
  );
}
