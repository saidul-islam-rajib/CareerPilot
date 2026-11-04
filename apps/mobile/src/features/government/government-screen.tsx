import { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import type { CircularFilters } from '@careerpilot/api-client';
import { enumLabelKey, eligibilityKey, useCirculars, useFormat, useGovApplications, useGovUpcoming, useT } from '@careerpilot/client-core';
import { CircularPhase, DeadlineSubject, Eligibility, StatusTone } from '@careerpilot/domain-ui-logic';
import { Routes } from '@/core/navigation/routes';
import { useTheme } from '@/core/theme/theme';
import { Badge, Card, EmptyState, ErrorState, ListRow, LoadingState, Screen, Section, SwitchRow, Text, TextField, TextTone, TextVariant } from '@/ui';

const GRADE_PATTERN = /\d+/g;
const TONES: Record<Eligibility, StatusTone> = {
  [Eligibility.Met]: StatusTone.Success,
  [Eligibility.NotMet]: StatusTone.Danger,
  [Eligibility.Unknown]: StatusTone.Neutral,
};

export function parseGrades(text: string): number[] {
  return (text.match(GRADE_PATTERN) ?? []).map(Number);
}

function Filters({ filters, onChange }: { filters: CircularFilters; onChange: (next: CircularFilters) => void }) {
  const t = useT();
  const [grades, setGrades] = useState('');
  return (
    <Card>
      <TextField
        label={t('government.filters.grades')}
        hint={t('government.filters.gradeHint')}
        value={grades}
        keyboardType="numbers-and-punctuation"
        onChangeText={(value) => {
          setGrades(value);
          onChange({ ...filters, grades: parseGrades(value) });
        }}
      />
      <TextField label={t('government.filters.authority')} value={filters.authority ?? ''} onChangeText={(value) => onChange({ ...filters, authority: value })} />
      <TextField label={t('government.filters.location')} value={filters.location ?? ''} onChangeText={(value) => onChange({ ...filters, location: value })} />
      <SwitchRow label={t('government.filters.eligibleOnly')} value={Boolean(filters.eligibleOnly)} onChange={(value) => onChange({ ...filters, eligibleOnly: value })} />
    </Card>
  );
}

function Mine() {
  const t = useT();
  const router = useRouter();
  const format = useFormat();
  const theme = useTheme();
  const applications = useGovApplications();
  const upcoming = useGovUpcoming();
  return (
    <>
      <Section title={t('government.application.upcoming')}>
        {upcoming.data?.length ? (
          <Card>
            {upcoming.data.map((item) => (
              <View key={`${item.applicationId}-${item.subject}-${item.on}`} style={{ gap: theme.space.xs }}>
                <Text variant={TextVariant.Subheading}>
                  {item.subject === DeadlineSubject.Stage && item.stage ? t(enumLabelKey('gov_stage', item.stage)) : t(enumLabelKey('deadline_subject', item.subject))} · {format.date(item.on)}
                </Text>
                <Text tone={TextTone.Muted}>{item.circularTitle}</Text>
              </View>
            ))}
          </Card>
        ) : (
          <EmptyState title={t('government.application.noUpcoming')} />
        )}
      </Section>
      <Section title={t('government.application.title')}>
        {applications.data?.length ? (
          <Card padded={false}>
            {applications.data.map((application) => (
              <ListRow
                key={application.id}
                title={application.circularTitle}
                subtitle={`${application.authority} · ${t(enumLabelKey('gov_application_status', application.status))}`}
                onPress={() => router.push(Routes.governmentApplication(application.id))}
              />
            ))}
          </Card>
        ) : (
          <EmptyState title={t('government.emptyApplications')} />
        )}
      </Section>
    </>
  );
}

export function GovernmentScreen() {
  const t = useT();
  const router = useRouter();
  const format = useFormat();
  const theme = useTheme();
  const [filters, setFilters] = useState<CircularFilters>({});
  const circulars = useCirculars(filters);
  if (circulars.isError) {
    return <ErrorState onRetry={() => void circulars.refetch()} />;
  }
  return (
    <Screen testID="government-screen">
      <Text tone={TextTone.Muted}>{t('government.subtitle')}</Text>
      <Filters filters={filters} onChange={setFilters} />
      {circulars.isPending ? <LoadingState /> : null}
      {circulars.data?.length === 0 ? <EmptyState title={t('government.empty')} /> : null}
      {circulars.data?.map((circular) => (
        <Card key={circular.id} onPress={() => router.push(Routes.governmentCircular(circular.id))} accessibilityLabel={circular.title}>
          <Text variant={TextVariant.Subheading}>{circular.title}</Text>
          <Text tone={TextTone.Muted}>{circular.authority}</Text>
          <Text>
            {circular.closesOn ? t('government.circular.closes', { date: format.date(circular.closesOn) }) : t('government.circular.closesNone')}
          </Text>
          <Badge label={t(enumLabelKey('circular_phase', circular.phase))} tone={circular.phase === CircularPhase.Open ? StatusTone.Success : StatusTone.Neutral} />
          {circular.posts.map((post) => (
            <View key={post.id} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: theme.space.sm }}>
              <Text style={{ flex: 1 }}>
                {post.title}
                {post.grade ? ` · ${t('government.circular.grade', { grade: post.grade })}` : ''}
              </Text>
              <Badge label={t(eligibilityKey(post.eligibility))} tone={TONES[post.eligibility]} />
            </View>
          ))}
        </Card>
      ))}
      <Mine />
    </Screen>
  );
}
