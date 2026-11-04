'use client';

import Link from 'next/link';
import { studyOpportunities, useAcademicActions, useDashboard, useFormat, usePrograms, useT } from '@careerpilot/client-core';
import { DeadlineKind, IntakeTerm, StudyKind } from '@careerpilot/domain-ui-logic';
import { emptyProgramInput } from '@careerpilot/api-client';
import { Button, Card, EmptyState, ErrorState, ListRow, LoadingState, Section } from '@careerpilot/ui-web';
import { Routes } from '@/core/routes';
import { useEnumLabel, useEnumOptions } from './academic-parts';
import { dayOrUndefined, FieldType, numberOrUndefined, RecordForm, textOf, type FieldSpec, type FormValues } from './record-form';

const INITIAL: FormValues = {
  kind: StudyKind.TaughtMasters,
  title: '',
  university: '',
  countryCode: '',
  term: '',
  year: '',
  deadlineKind: DeadlineKind.Application,
  deadlineOn: '',
};

export function ProgramsTab() {
  const t = useT();
  const format = useFormat();
  const label = useEnumLabel();
  const options = useEnumOptions();
  const programs = usePrograms();
  const dashboard = useDashboard();
  const actions = useAcademicActions();
  const trackedIds = (programs.data ?? []).flatMap((p) => (p.opportunityId ? [p.opportunityId] : []));
  const suggestions = studyOpportunities(dashboard.data, trackedIds);

  const fields: FieldSpec[] = [
    { key: 'kind', label: t('academic.fields.kind'), type: FieldType.Select, options: options('StudyKind', Object.values(StudyKind)) },
    { key: 'title', label: t('academic.fields.title'), type: FieldType.Text },
    { key: 'university', label: t('academic.fields.university'), type: FieldType.Text },
    { key: 'countryCode', label: t('academic.fields.countryCode'), type: FieldType.Text },
    {
      key: 'term',
      label: t('academic.fields.term'),
      type: FieldType.Select,
      options: [{ value: '', label: '-' }, ...options('IntakeTerm', Object.values(IntakeTerm))],
    },
    { key: 'year', label: t('academic.fields.year'), type: FieldType.Number },
    {
      key: 'deadlineKind',
      label: t('academic.fields.deadlineKind'),
      type: FieldType.Select,
      options: options('DeadlineKind', Object.values(DeadlineKind)),
    },
    { key: 'deadlineOn', label: t('academic.fields.deadlineOn'), type: FieldType.Date },
  ];

  const create = (values: FormValues) => {
    const deadline = dayOrUndefined(values.deadlineOn);
    return actions.createProgram.mutateAsync({
      ...emptyProgramInput(),
      kind: values.kind as StudyKind,
      title: textOf(values.title),
      university: textOf(values.university),
      countryCode: textOf(values.countryCode).toUpperCase(),
      term: (dayOrUndefined(values.term) as IntakeTerm | undefined) ?? undefined,
      year: numberOrUndefined(values.year),
      deadlines: deadline ? [{ kind: values.deadlineKind as DeadlineKind, on: deadline, note: '', sourceUrl: '' }] : [],
    });
  };

  if (programs.isLoading) {
    return <LoadingState />;
  }
  if (programs.isError) {
    return <ErrorState onRetry={() => void programs.refetch()} />;
  }

  return (
    <div className="flex flex-col gap-6">
      <Section title={t('academic.tabs.programs')}>
        {programs.data?.length ? (
          <Card>
            {programs.data.map((program) => (
              <ListRow
                key={program.id}
                title={program.title}
                subtitle={[
                  program.university,
                  label('StudyKind', program.kind),
                  program.deadlines[0] ? `${label('DeadlineKind', program.deadlines[0].kind)} ${format.date(program.deadlines[0].on)}` : undefined,
                ]
                  .filter(Boolean)
                  .join(' · ')}
                href={Routes.studentsProgram(program.id)}
              />
            ))}
          </Card>
        ) : (
          <EmptyState title={t('academic.common.none')} />
        )}
      </Section>
      {suggestions.length ? (
        <Section title={t('academic.program.from')}>
          <p className="text-sm text-muted">{t('academic.program.fromHint')}</p>
          <Card>
            {suggestions.map((opportunity) => (
              <div key={opportunity.id} className="flex flex-wrap items-center justify-between gap-2 py-1">
                <div>
                  <Link href={Routes.opportunity(opportunity.id)} className="font-medium text-primary hover:underline">
                    {opportunity.title}
                  </Link>
                  <p className="text-sm text-muted">{opportunity.organization}</p>
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  loading={actions.fromOpportunity.isPending}
                  onClick={() => actions.fromOpportunity.mutate(opportunity.id)}
                >
                  {t('academic.program.from')}
                </Button>
              </div>
            ))}
          </Card>
        </Section>
      ) : null}
      <Section title={t('academic.program.add')}>
        <Card>
          <RecordForm fields={fields} initial={INITIAL} submitLabel={t('academic.common.add')} onSubmit={create} />
        </Card>
      </Section>
    </div>
  );
}
