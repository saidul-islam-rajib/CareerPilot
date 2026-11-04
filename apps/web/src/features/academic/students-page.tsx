'use client';

import { useState } from 'react';
import { useAcademicOverview, useFormat, useT } from '@careerpilot/client-core';
import { Card, ErrorState, LoadingState, PageHeader, Section, Segmented } from '@careerpilot/ui-web';
import { AttentionBadge, Notices, useEnumLabel, WarningLine } from './academic-parts';
import { OutreachTab } from './outreach-tab';
import { ProgramsTab } from './programs-tab';
import { CredentialsTab, RefereesTab, TestsTab } from './records-tabs';

export const Tab = { Programs: 'programs', Tests: 'tests', Credentials: 'credentials', Referees: 'referees', Outreach: 'outreach' } as const;
export type Tab = (typeof Tab)[keyof typeof Tab];

function Overview() {
  const t = useT();
  const format = useFormat();
  const label = useEnumLabel();
  const overview = useAcademicOverview();
  if (overview.isLoading) {
    return <LoadingState />;
  }
  if (overview.isError || !overview.data) {
    return <ErrorState onRetry={() => void overview.refetch()} />;
  }
  const { attention, upcoming, warnings, programs } = overview.data;
  return (
    <Section title={t('academic.overview.heading')}>
      <Card className="gap-3">
        <p className="text-sm text-muted">{t('academic.overview.programs', { count: programs })}</p>
        {attention.length ? (
          attention.map((item) => (
            <div key={`${item.kind}-${item.recordId ?? item.programId ?? ''}-${item.on ?? ''}`}>
              <AttentionBadge item={item} />
            </div>
          ))
        ) : (
          <p className="text-sm">{t('academic.overview.nothing')}</p>
        )}
        {warnings.map((warning) => (
          <WarningLine key={`${warning.programId}-${warning.kind}-${warning.exam ?? ''}`} warning={warning} />
        ))}
        {upcoming.length ? <p className="font-medium">{t('academic.overview.upcoming')}</p> : null}
        {upcoming.map((item) => (
          <p key={`${item.programId ?? ''}-${item.kind}-${item.on}`} className="text-sm">
            {label('DeadlineKind', item.kind)} · {format.date(item.on)}
          </p>
        ))}
      </Card>
    </Section>
  );
}

export function StudentsPage() {
  const t = useT();
  const [tab, setTab] = useState<Tab>(Tab.Programs);
  const options = Object.values(Tab).map((value) => ({ value, label: t(`academic.tabs.${value}`) }));
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t('academic.title')} description={t('academic.subtitle')} />
      <Notices />
      <Overview />
      <Segmented options={options} value={tab} onChange={setTab} label={t('academic.title')} />
      {tab === Tab.Programs ? <ProgramsTab /> : null}
      {tab === Tab.Tests ? <TestsTab /> : null}
      {tab === Tab.Credentials ? <CredentialsTab /> : null}
      {tab === Tab.Referees ? <RefereesTab /> : null}
      {tab === Tab.Outreach ? <OutreachTab /> : null}
    </div>
  );
}
