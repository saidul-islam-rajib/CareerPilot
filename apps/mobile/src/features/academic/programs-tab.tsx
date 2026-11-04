import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { studyOpportunities, useAcademicActions, useDashboard, useFormat, usePrograms, useT } from '@careerpilot/client-core';
import { DeadlineKind, IntakeTerm, StudyKind } from '@careerpilot/domain-ui-logic';
import { emptyProgramInput } from '@careerpilot/api-client';
import { Routes } from '@/core/navigation/routes';
import { useTheme } from '@/core/theme/theme';
import { Button, ButtonVariant, Card, EmptyState, ErrorState, ListRow, LoadingState, Section, Text, TextTone } from '@/ui';
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
  const router = useRouter();
  const theme = useTheme();
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
    { key: 'deadlineOn', label: t('academic.fields.deadlineOn'), type: FieldType.Date, hint: 'YYYY-MM-DD' },
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

  if (programs.isPending) {
    return <LoadingState />;
  }
  if (programs.isError) {
    return <ErrorState onRetry={() => void programs.refetch()} />;
  }

  return (
    <View style={{ gap: theme.space.lg }}>
      <Section title={t('academic.tabs.programs')}>
        {programs.data.length ? (
          <Card padded={false}>
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
                onPress={() => router.push(Routes.studentsProgram(program.id))}
              />
            ))}
          </Card>
        ) : (
          <EmptyState title={t('academic.common.none')} />
        )}
      </Section>
      {suggestions.length ? (
        <Section title={t('academic.program.from')}>
          <Text tone={TextTone.Muted}>{t('academic.program.fromHint')}</Text>
          {suggestions.map((opportunity) => (
            <Card key={opportunity.id}>
              <Text>{opportunity.title}</Text>
              <Text tone={TextTone.Muted}>{opportunity.organization}</Text>
              <Button
                label={t('academic.program.from')}
                variant={ButtonVariant.Secondary}
                onPress={() => actions.fromOpportunity.mutate(opportunity.id)}
              />
            </Card>
          ))}
        </Section>
      ) : null}
      <Section title={t('academic.program.add')}>
        <Card>
          <RecordForm fields={fields} initial={INITIAL} submitLabel={t('academic.common.add')} onSubmit={create} />
        </Card>
      </Section>
    </View>
  );
}
