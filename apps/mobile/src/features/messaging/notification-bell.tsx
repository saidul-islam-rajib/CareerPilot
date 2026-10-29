import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useInbox, useT } from '@careerpilot/client-core';
import { Bell } from '@/ui/icons';
import { Routes } from '@/core/navigation/routes';
import { useTheme } from '@/core/theme/theme';
import { Icon, Text, TextVariant } from '@/ui';

export function NotificationBell() {
  const t = useT();
  const theme = useTheme();
  const router = useRouter();
  const inbox = useInbox();
  const count = inbox.data?.unreadNotifications ?? 0;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={count ? t('notifications.bellUnread', { count }) : t('notifications.bell')}
      onPress={() => router.push(Routes.inbox)}
      hitSlop={theme.space.xs}
      style={{ width: theme.touchTarget, height: theme.touchTarget, alignItems: 'center', justifyContent: 'center' }}
      testID="notification-bell"
    >
      <Icon icon={Bell} color={theme.colors.text} />
      {count ? (
        <View
          style={{
            position: 'absolute',
            top: theme.space.xxs,
            right: theme.space.xxs,
            minWidth: theme.space.lg,
            paddingHorizontal: theme.space.xxs,
            borderRadius: theme.radius.pill,
            backgroundColor: theme.colors.danger,
            alignItems: 'center',
          }}
        >
          <Text variant={TextVariant.Caption} style={{ color: theme.colors.primaryForeground, fontWeight: theme.fontWeight.bold }}>
            {count}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}
