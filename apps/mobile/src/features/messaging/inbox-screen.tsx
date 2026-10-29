import { useCallback } from 'react';
import { FlatList, Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import type { AppNotification } from '@careerpilot/api-client';
import { useFormat, useNewNotifications, useNotifications, useReadNotifications, useT } from '@careerpilot/client-core';
import { NotificationTarget } from '@careerpilot/domain-ui-logic';
import { BriefcaseBusiness, CheckCheck, MessageCircle } from '@/ui/icons';
import { Routes } from '@/core/navigation/routes';
import { useTheme } from '@/core/theme/theme';
import { Button, ButtonVariant, EmptyState, ErrorState, Icon, LoadingState, Text, TextTone, TextVariant, useSnackbar } from '@/ui';

export function notificationRoute(notification: AppNotification) {
  return notification.target === NotificationTarget.Conversation ? Routes.chat(notification.targetId) : Routes.application(notification.targetId);
}

export function useNotificationBanner() {
  const t = useT();
  const router = useRouter();
  const snackbar = useSnackbar();
  const show = useCallback(
    (notification: AppNotification) =>
      snackbar.show({ message: `${notification.title}: ${notification.body}`, actionLabel: t('notifications.open'), onAction: () => router.push(notificationRoute(notification)) }),
    [router, snackbar, t],
  );
  useNewNotifications(show);
}

export function InboxScreen() {
  const t = useT();
  const theme = useTheme();
  const format = useFormat();
  const router = useRouter();
  const notifications = useNotifications();
  const read = useReadNotifications();
  if (notifications.isPending) {
    return <LoadingState />;
  }
  if (notifications.isError) {
    return <ErrorState onRetry={() => void notifications.refetch()} />;
  }
  const unread = notifications.data.some((n) => !n.read);
  return (
    <FlatList
      data={notifications.data}
      keyExtractor={(n) => n.id}
      style={{ backgroundColor: theme.colors.surface }}
      contentContainerStyle={{ padding: theme.space.lg, gap: theme.space.sm }}
      ListHeaderComponent={
        unread ? <Button label={t('notifications.markAllRead')} icon={CheckCheck} variant={ButtonVariant.Outline} loading={read.isPending} onPress={() => read.mutate(undefined)} testID="read-all" /> : undefined
      }
      ListEmptyComponent={<EmptyState body={t('notifications.empty')} />}
      renderItem={({ item }) => (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${item.title}. ${item.body}`}
          onPress={() => {
            read.mutate([item.id]);
            router.push(notificationRoute(item));
          }}
          style={{
            flexDirection: 'row',
            gap: theme.space.md,
            padding: theme.space.md,
            borderRadius: theme.radius.card,
            borderWidth: theme.borderWidth.hairline,
            borderColor: item.read ? theme.colors.border : theme.colors.primary,
            backgroundColor: item.read ? theme.colors.card : theme.colors.primarySubtle,
          }}
          testID={`notification-${item.id}`}
        >
          <Icon icon={item.target === NotificationTarget.Conversation ? MessageCircle : BriefcaseBusiness} color={theme.colors.primary} />
          <View style={{ flex: 1, gap: theme.space.xxs }}>
            <Text variant={TextVariant.Subheading}>{item.title}</Text>
            <Text tone={TextTone.Muted}>{item.body}</Text>
            <Text variant={TextVariant.Caption} tone={TextTone.Muted}>
              {format.dateTime(item.createdAt)}
            </Text>
          </View>
        </Pressable>
      )}
      testID="inbox-screen"
    />
  );
}
