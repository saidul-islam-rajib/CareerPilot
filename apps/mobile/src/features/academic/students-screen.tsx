import { useState } from 'react';
import { View } from 'react-native';
import { useAcademicOverview, useFormat, useT } from '@careerpilot/client-core';
import { useTheme } from '@/core/theme/theme';
import { Card, ErrorState, LoadingState, Screen, Section, Segmented, Text, TextTone } from '@/ui';
import { AttentionBadge, Notices, useEnumLabel, WarningLine } from './academic-parts';
import { OutreachTab } from './outreach-tab';
import { ProgramsTab } from './programs-tab';
import { CredentialsTab, RefereesTab, TestsTab } from './records-tabs';

export const Tab = { Programs: 'programs', Tests: 'tests', Credentials: 'credentials', Referees: 'referees', Outreach: 'outreach' } as const;
export type Tab = (typeof Tab)[keyof typeof Tab];

function Overview() {
  const t = useT();
  const theme = useTheme();
  const format = useFormat();
  const label = useEnumLabel();
  const overview = useAcademicOverview();
  if (overview.isPending) {
    return <LoadingState />;
  }
  if (overview.isError) {
    return <ErrorState onRetry={() => void overview.refetch()} />;
  }
  const { attention, upcoming, warnings, programs } = overview.data;
  return (
    <Section title={t('academic.overview.heading')}>
      <Card>
        <View style={{ gap: theme.space.sm }}>
          <Text tone={TextTone.Muted}>{t('academic.overview.programs', { count: programs })}</Text>
          {attention.length ? (
            attention.map((item) => <AttentionBadge key={`${item.kind}-${item.recordId ?? item.programId ?? ''}-${item.on ?? ''}`} item={item} />)
          ) : (
            <Text>{t('academic.overview.nothing')}</Text>
          )}
          {warnings.map((warning) => (
            <WarningLine key={`${warning.programId}-${warning.kind}-${warning.exam ?? ''}`} warning={warning} />
          ))}
          {upcoming.length ? <Text>{t('academic.overview.upcoming')}</Text> : null}
          {upcoming.map((item) => (
            <Text key={`${item.programId ?? ''}-${item.kind}-${item.on}`} tone={TextTone.Muted}>
              {label('DeadlineKind', item.kind)} · {format.date(item.on)}
            </Text>
          ))}
        </View>
      </Card>
    </Section>
  );
}

export function StudentsScreen() {
  const t = useT();
  const [tab, setTab] = useState<Tab>(Tab.Programs);
  const options = Object.values(Tab).map((value) => ({ value, label: t(`academic.tabs.${value}`) }));
  return (
    <Screen testID="students-screen">
      <Text tone={TextTone.Muted}>{t('academic.subtitle')}</Text>
      <Notices />
      <Overview />
      <Segmented options={options} value={tab} onChange={setTab} accessibilityLabel={t('academic.title')} />
      {tab === Tab.Programs ? <ProgramsTab /> : null}
      {tab === Tab.Tests ? <TestsTab /> : null}
      {tab === Tab.Credentials ? <CredentialsTab /> : null}
      {tab === Tab.Referees ? <RefereesTab /> : null}
      {tab === Tab.Outreach ? <OutreachTab /> : null}
    </Screen>
  );
}
