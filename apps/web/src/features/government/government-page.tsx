'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { CircularFilters, CircularSummary } from '@careerpilot/api-client';
import { useCirculars, useFormat, useGovApplications, useGovUpcoming, useT } from '@careerpilot/client-core';
import { CircularPhase, DeadlineSubject, StatusTone } from '@careerpilot/domain-ui-logic';
import { Badge, Card, EmptyState, ErrorState, ListRow, LoadingState, PageHeader, Section, SelectField, TextField, SwitchField } from '@careerpilot/ui-web';
import { Routes } from '@/core/routes';
import { DayNote, EligibilityBadge, enumLabelKey } from './government-parts';

const PHASE_TONES: Record<CircularPhase, StatusTone> = {
  [CircularPhase.Upcoming]: StatusTone.Info,
  [CircularPhase.Open]: StatusTone.Success,
  [CircularPhase.Closed]: StatusTone.Neutral,
};
const ALL = '';
const GRADE_PATTERN = /\d+/g;

export function parseGrades(text: string): number[] {
  return (text.match(GRADE_PATTERN) ?? []).map(Number);
}

function CircularCard({ circular }: { circular: CircularSummary }) {
  const t = useT();
  const format = useFormat();
  return (
    <Card className="gap-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <Link href={Routes.governmentCircular(circular.id)} className="text-lg font-semibold text-primary hover:underline">
            {circular.title}
          </Link>
          <p className="text-sm text-muted">{circular.authority}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {circular.amended ? <Badge label={t('government.circular.amended')} tone={StatusTone.Warning} /> : null}
          <Badge label={t(enumLabelKey('circular_phase', circular.phase))} tone={PHASE_TONES[circular.phase]} />
        </div>
      </div>
      <p className="text-sm">
        {circular.closesOn ? t('government.circular.closes', { date: format.date(circular.closesOn) }) : t('government.circular.closesNone')} ·{' '}
        {t('government.circular.vacancies', { count: circular.vacancies })}
      </p>
      <ul className="flex flex-col gap-1">
        {circular.posts.map((post) => (
          <li key={post.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span>
              {post.title}
              {post.grade ? ` · ${t('government.circular.grade', { grade: post.grade })}` : ''}
            </span>
            <EligibilityBadge outcome={post.eligibility} />
          </li>
        ))}
      </ul>
    </Card>
  );
}

function Filters({ filters, onChange }: { filters: CircularFilters; onChange: (next: CircularFilters) => void }) {
  const t = useT();
  const [grades, setGrades] = useState('');
  return (
    <Card className="grid gap-3 md:grid-cols-2">
      <TextField
        label={t('government.filters.grades')}
        hint={t('government.filters.gradeHint')}
        value={grades}
        onChange={(event) => {
          setGrades(event.target.value);
          onChange({ ...filters, grades: parseGrades(event.target.value) });
        }}
      />
      <TextField label={t('government.filters.authority')} value={filters.authority ?? ''} onChange={(event) => onChange({ ...filters, authority: event.target.value })} />
      <TextField label={t('government.filters.location')} value={filters.location ?? ''} onChange={(event) => onChange({ ...filters, location: event.target.value })} />
      <SelectField
        label={t('government.filters.phase')}
        value={filters.phase ?? ALL}
        options={[{ value: ALL, label: t('government.filters.all') }, ...Object.values(CircularPhase).map((phase) => ({ value: phase, label: t(enumLabelKey('circular_phase', phase)) }))]}
        onValueChange={(value) => onChange({ ...filters, phase: value ? (value as CircularPhase) : undefined })}
      />
      <SwitchField
        className="md:col-span-2"
        label={t('government.filters.eligibleOnly')}
        checked={Boolean(filters.eligibleOnly)}
        onChange={(value) => onChange({ ...filters, eligibleOnly: value })}
      />
    </Card>
  );
}

function ApplicationsSection() {
  const t = useT();
  const applications = useGovApplications();
  const upcoming = useGovUpcoming();
  const format = useFormat();
  return (
    <>
      <Section title={t('government.application.upcoming')}>
        {upcoming.data?.length ? (
          <Card>
            {upcoming.data.map((item) => (
              <div key={`${item.applicationId}-${item.subject}-${item.on}`} className="flex flex-col gap-1 py-1">
                <p className="font-medium">
                  {item.subject === DeadlineSubject.Stage && item.stage ? t(enumLabelKey('gov_stage', item.stage)) : t(`enums.deadline_subject.${item.subject}`)} · {format.date(item.on)}
                </p>
                <p className="text-sm text-muted">{item.circularTitle}</p>
                <DayNote note={item.note} />
              </div>
            ))}
          </Card>
        ) : (
          <EmptyState title={t('government.application.noUpcoming')} />
        )}
      </Section>
      <Section title={t('government.application.title')}>
        {applications.data?.length ? (
          <Card>
            {applications.data.map((application) => (
              <ListRow
                key={application.id}
                title={application.circularTitle}
                subtitle={`${application.authority} · ${t(enumLabelKey('gov_application_status', application.status))}`}
                href={Routes.governmentApplication(application.id)}
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

export function GovernmentPage() {
  const t = useT();
  const [filters, setFilters] = useState<CircularFilters>({});
  const circulars = useCirculars(filters);
  return (
    <>
      <PageHeader title={t('government.title')} description={t('government.subtitle')} />
      <Filters filters={filters} onChange={setFilters} />
      {circulars.isPending ? <LoadingState /> : null}
      {circulars.isError ? <ErrorState onRetry={() => void circulars.refetch()} /> : null}
      {circulars.data?.length === 0 ? <EmptyState title={t('government.empty')} /> : null}
      <div className="flex flex-col gap-3">{circulars.data?.map((circular) => <CircularCard key={circular.id} circular={circular} />)}</div>
      <ApplicationsSection />
    </>
  );
}
