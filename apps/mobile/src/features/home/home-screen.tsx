import { useRouter } from 'expo-router';
import { trackTitle, useDashboard, useFormat, useResume, useSession, useT } from '@careerpilot/client-core';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PauseCircle } from 'lucide-react-native';
import { StatusTone } from '@careerpilot/domain-ui-logic';
import { Routes } from '@/core/navigation/routes';
import { useTheme } from '@/core/theme/theme';
import { OpportunityCard } from '@/features/opportunities/opportunity-card';
import { Banner, BrandMark, Button, ButtonVariant, Card, EmptyState, ErrorState, LoadingState, Screen, Section, Text, TextTone, TextVariant } from '@/ui';

function StatTile({ label, value, onPress }: { label: string; value: number; onPress?: () => void }) {
  const theme = useTheme();
  return (
    <Card onPress={onPress} accessibilityLabel={`${label}: ${value}`} style={{ flexGrow: 1, flexBasis: '45%' }}>
      <Text variant={TextVariant.Title} tone={TextTone.Primary}>
        {value}
      </Text>
      <Text variant={TextVariant.Label} tone={TextTone.Muted} style={{ marginTop: -theme.space.xs }}>
        {label}
      </Text>
    </Card>
  );
}

export function HomeScreen() {
  const t = useT();
  const theme = useTheme();
  const router = useRouter();
  const format = useFormat();
  const { user } = useSession();
  const dashboard = useDashboard();
  const resume = useResume();
  const firstName = user?.fullName.split(' ')[0] ?? '';

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: theme.colors.surface }}>
      <Screen refreshing={dashboard.isRefetching} onRefresh={() => void dashboard.refetch()} testID="home-screen">
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space.md }}>
          <BrandMark size={theme.space.xxl + theme.space.sm} />
          <View style={{ flex: 1 }}>
            <Text variant={TextVariant.Title}>{t('home.greeting', { name: firstName })}</Text>
            <Text tone={TextTone.Muted}>{t('home.summary')}</Text>
          </View>
        </View>

        {dashboard.isPending ? <LoadingState /> : null}
        {dashboard.isError ? <ErrorState onRetry={() => void dashboard.refetch()} /> : null}

        {dashboard.data ? (
          <>
            {dashboard.data.pause ? (
              <Banner
                tone={StatusTone.Warning}
                icon={PauseCircle}
                title={t('home.pausedTitle')}
                body={dashboard.data.pause.until ? t('home.pausedUntil', { date: format.date(dashboard.data.pause.until) }) : t('home.pausedIndefinitely')}
                action={<Button label={t('home.resume')} variant={ButtonVariant.Outline} onPress={() => resume.mutate()} loading={resume.isPending} />}
              />
            ) : null}

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.space.md }}>
              <StatTile label={t('home.newMatches')} value={dashboard.data.counts.newMatches} />
              <StatTile label={t('home.awaitingApproval')} value={dashboard.data.counts.awaitingApproval} onPress={() => router.push(Routes.approvals)} />
              <StatTile label={t('home.appliedThisWeek')} value={dashboard.data.counts.appliedThisWeek} onPress={() => router.push(Routes.applications)} />
              <StatTile label={t('home.interviews')} value={dashboard.data.counts.interviews} onPress={() => router.push(Routes.applications)} />
            </View>

            <Text variant={TextVariant.Caption} tone={TextTone.Muted}>
              {t('home.lastChecked', { date: format.dateTime(dashboard.data.lastCheckedAt) })}
            </Text>

            {dashboard.data.tracks.map(({ track, opportunities }) => (
              <Section key={track.id} title={trackTitle(track, t)}>
                {opportunities.length === 0 ? (
                  <EmptyState body={t('home.trackEmpty')} />
                ) : (
                  opportunities.map((opportunity) => (
                    <OpportunityCard key={opportunity.id} opportunity={opportunity} onPress={() => router.push(Routes.opportunity(opportunity.id))} />
                  ))
                )}
              </Section>
            ))}
          </>
        ) : null}
      </Screen>
    </SafeAreaView>
  );
}
