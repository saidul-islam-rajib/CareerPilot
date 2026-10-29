import { Tabs } from 'expo-router';
import { queryKeys, useApi, useInbox, useT } from '@careerpilot/client-core';
import type { ColorValue } from 'react-native';
import { Briefcase, CircleCheckBig, House, Menu, MessageCircle, UserRound, type LucideIcon } from '@/ui/icons';
import { useQuery } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/core/theme/theme';
import { NotificationBell } from '@/features/messaging/notification-bell';

function tabIcon(icon: LucideIcon) {
  return function TabIcon({ color, size }: { color: ColorValue; size: number }) {
    const Glyph = icon;
    return <Glyph color={String(color)} size={size} />;
  };
}

export default function TabsLayout() {
  const t = useT();
  const theme = useTheme();
  const api = useApi();
  const insets = useSafeAreaInsets();
  const approvals = useQuery({ queryKey: queryKeys.approvals, queryFn: () => api.approvals.listApprovals() });
  const pending = approvals.data?.length ?? 0;
  const inbox = useInbox();
  const unreadMessages = inbox.data?.unreadMessages ?? 0;
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textMuted,
        tabBarStyle: {
          backgroundColor: theme.colors.background,
          borderTopColor: theme.colors.border,
          height: theme.touchTarget + theme.space.xl + insets.bottom,
          paddingTop: theme.space.xs,
          paddingBottom: insets.bottom + theme.space.sm,
        },
        tabBarLabelStyle: { fontSize: theme.fontSize.xs, fontWeight: theme.fontWeight.medium },
        headerStyle: { backgroundColor: theme.colors.background },
        headerTitleStyle: { color: theme.colors.text },
        headerShadowVisible: false,
        tabBarBadgeStyle: { backgroundColor: theme.colors.accent, color: theme.colors.accentForeground },
        headerRight: () => <NotificationBell />,
      }}
    >
      <Tabs.Screen name="index" options={{ title: t('nav.home'), tabBarIcon: tabIcon(House), headerShown: false }} />
      <Tabs.Screen
        name="approvals"
        options={{ title: t('nav.approvals'), tabBarIcon: tabIcon(CircleCheckBig), tabBarBadge: pending > 0 ? pending : undefined }}
      />
      <Tabs.Screen
        name="chats"
        options={{ title: t('messaging.title'), tabBarIcon: tabIcon(MessageCircle), tabBarBadge: unreadMessages > 0 ? unreadMessages : undefined }}
      />
      <Tabs.Screen name="applications" options={{ title: t('nav.applications'), tabBarIcon: tabIcon(Briefcase) }} />
      <Tabs.Screen name="profile" options={{ title: t('nav.profile'), tabBarIcon: tabIcon(UserRound) }} />
      <Tabs.Screen name="more" options={{ title: t('nav.more'), tabBarIcon: tabIcon(Menu) }} />
    </Tabs>
  );
}
