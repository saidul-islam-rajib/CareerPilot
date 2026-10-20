import { Tabs } from 'expo-router';
import type { ColorValue } from 'react-native';
import { Briefcase, CircleCheckBig, House, Menu, UserRound, type LucideIcon } from 'lucide-react-native';
import { useQuery } from '@tanstack/react-query';
import { useT } from '@/core/i18n/i18n';
import { queryKeys } from '@/core/query/query-keys';
import { useApi } from '@/core/services/app-services';
import { useTheme } from '@/core/theme/theme';

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
  const approvals = useQuery({ queryKey: queryKeys.approvals, queryFn: () => api.approvals.listApprovals() });
  const pending = approvals.data?.length ?? 0;
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textMuted,
        tabBarStyle: { backgroundColor: theme.colors.background, borderTopColor: theme.colors.border },
        tabBarLabelStyle: { fontSize: theme.fontSize.xs, fontWeight: theme.fontWeight.medium },
        headerStyle: { backgroundColor: theme.colors.background },
        headerTitleStyle: { color: theme.colors.text },
        headerShadowVisible: false,
        tabBarBadgeStyle: { backgroundColor: theme.colors.accent, color: theme.colors.accentForeground },
      }}
    >
      <Tabs.Screen name="index" options={{ title: t('nav.home'), tabBarIcon: tabIcon(House), headerShown: false }} />
      <Tabs.Screen
        name="approvals"
        options={{ title: t('nav.approvals'), tabBarIcon: tabIcon(CircleCheckBig), tabBarBadge: pending > 0 ? pending : undefined }}
      />
      <Tabs.Screen name="applications" options={{ title: t('nav.applications'), tabBarIcon: tabIcon(Briefcase) }} />
      <Tabs.Screen name="profile" options={{ title: t('nav.profile'), tabBarIcon: tabIcon(UserRound) }} />
      <Tabs.Screen name="more" options={{ title: t('nav.more'), tabBarIcon: tabIcon(Menu) }} />
    </Tabs>
  );
}
