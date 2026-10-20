import { useRouter } from 'expo-router';
import { useApprovals, useFormat, useT } from '@careerpilot/client-core';
import { View } from 'react-native';
import { Clock } from 'lucide-react-native';
import { Routes } from '@/core/navigation/routes';
import { useTheme } from '@/core/theme/theme';
import { OpportunityCard } from '@/features/opportunities/opportunity-card';
import { EmptyState, ErrorState, Icon, IconSize, LoadingState, Row, Screen, Text, TextTone, TextVariant } from '@/ui';

export function ApprovalsScreen() {
  const t = useT();
  const theme = useTheme();
  const router = useRouter();
  const format = useFormat();
  const approvals = useApprovals();
  const items = approvals.data ?? [];
  return (
    <Screen refreshing={approvals.isRefetching} onRefresh={() => void approvals.refetch()} testID="approvals-screen">
      {approvals.isPending ? <LoadingState /> : null}
      {approvals.isError ? <ErrorState onRetry={() => void approvals.refetch()} /> : null}
      {approvals.isSuccess && items.length === 0 ? <EmptyState title={t('approvals.empty')} /> : null}
      {items.length > 0 ? <Text tone={TextTone.Muted}>{t('approvals.pendingCount', { count: items.length })}</Text> : null}
      {items.map((approval) => (
        <View key={approval.id} style={{ gap: theme.space.xs }}>
          <Row gap={theme.space.xs}>
            <Icon icon={Clock} size={IconSize.Small} color={theme.colors.warning} />
            <Text variant={TextVariant.Caption} tone={TextTone.Warning}>
              {t('approvals.expiresOn', { date: format.dateTime(approval.expiresAt) })}
            </Text>
          </Row>
          <OpportunityCard opportunity={approval.opportunity} onPress={() => router.push(Routes.approval(approval.id))} />
        </View>
      ))}
    </Screen>
  );
}
