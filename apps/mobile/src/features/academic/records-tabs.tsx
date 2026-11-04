import { useState, type ReactNode } from 'react';
import { View } from 'react-native';
import {
  academicErrorKey,
  examsExpiringFirst,
  useAcademicActions,
  useCredentials,
  useExams,
  useFormat,
  useReferees,
  useT,
} from '@careerpilot/client-core';
import { AmountSource, CredentialKind, ExamKind, ExamStatus, GradeScale, StatusTone } from '@careerpilot/domain-ui-logic';
import { emptyCredentialInput, emptyExamInput, emptyRefereeInput } from '@careerpilot/api-client';
import { useTheme } from '@/core/theme/theme';
import {
  Badge,
  Button,
  ButtonVariant,
  Card,
  Checkbox,
  Divider,
  EmptyState,
  ErrorState,
  LoadingState,
  Section,
  Text,
  TextTone,
  TextVariant,
} from '@/ui';
import { useEnumLabel, useEnumOptions } from './academic-parts';
import { dayOrUndefined, FieldType, numberOrUndefined, RecordForm, textOf, type FieldSpec, type FormValues } from './record-form';

function Item({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  const theme = useTheme();
  return (
    <View style={{ gap: theme.space.xs }}>
      <Text variant={TextVariant.Subheading}>{title}</Text>
      {subtitle ? <Text tone={TextTone.Muted}>{subtitle}</Text> : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.space.sm, alignItems: 'center' }}>{children}</View>
    </View>
  );
}

export function TestsTab() {
  const t = useT();
  const theme = useTheme();
  const format = useFormat();
  const label = useEnumLabel();
  const options = useEnumOptions();
  const exams = useExams();
  const actions = useAcademicActions();
  const fields: FieldSpec[] = [
    { key: 'exam', label: t('academic.fields.exam'), type: FieldType.Select, options: options('ExamKind', Object.values(ExamKind)) },
    { key: 'status', label: t('academic.fields.testStatus'), type: FieldType.Select, options: options('ExamStatus', Object.values(ExamStatus)) },
    { key: 'registrationDeadline', label: t('academic.fields.registrationDeadline'), type: FieldType.Date, hint: 'YYYY-MM-DD' },
    { key: 'testOn', label: t('academic.fields.testOn'), type: FieldType.Date, hint: 'YYYY-MM-DD' },
    { key: 'scoreReleaseOn', label: t('academic.fields.scoreReleaseOn'), type: FieldType.Date, hint: 'YYYY-MM-DD' },
    { key: 'overall', label: t('academic.fields.overall'), type: FieldType.Number, hint: t('academic.tests.noScoreHint') },
    { key: 'validityMonths', label: t('academic.fields.validityMonths'), type: FieldType.Number },
    { key: 'feeAmount', label: t('academic.fields.feeAmount'), type: FieldType.Number },
  ];
  const initial: FormValues = {
    exam: ExamKind.Ielts,
    status: ExamStatus.Planned,
    registrationDeadline: '',
    testOn: '',
    scoreReleaseOn: '',
    overall: '',
    validityMonths: '',
    feeAmount: '',
  };
  const create = (values: FormValues) => {
    const overall = numberOrUndefined(values.overall);
    return actions.createExam.mutateAsync({
      ...emptyExamInput(),
      exam: values.exam as ExamKind,
      status: values.status as ExamStatus,
      registrationDeadline: dayOrUndefined(values.registrationDeadline),
      testOn: dayOrUndefined(values.testOn),
      scoreReleaseOn: dayOrUndefined(values.scoreReleaseOn),
      scores: overall === undefined ? undefined : { overall, sections: {} },
      validityMonths: numberOrUndefined(values.validityMonths),
      feeAmount: numberOrUndefined(values.feeAmount),
      feeSource: AmountSource.Estimate,
    });
  };
  if (exams.isPending) {
    return <LoadingState />;
  }
  if (exams.isError) {
    return <ErrorState onRetry={() => void exams.refetch()} />;
  }
  return (
    <View style={{ gap: theme.space.lg }}>
      <Section title={t('academic.tabs.tests')}>
        {exams.data.length ? (
          <Card>
            {examsExpiringFirst(exams.data).map((exam) => (
              <Item
                key={exam.id}
                title={`${label('ExamKind', exam.exam)} · ${label('ExamStatus', exam.status)}`}
                subtitle={[
                  exam.testOn ? format.date(exam.testOn) : undefined,
                  exam.scores?.overall !== undefined ? String(exam.scores.overall) : undefined,
                  exam.expiresOn ? t('academic.tests.expires', { date: format.date(exam.expiresOn) }) : t('academic.tests.expiresUnknown'),
                ]
                  .filter(Boolean)
                  .join(' · ')}
              >
                <Button label={t('academic.common.remove')} variant={ButtonVariant.Ghost} onPress={() => actions.removeExam.mutate(exam.id)} />
              </Item>
            ))}
          </Card>
        ) : (
          <EmptyState title={t('academic.common.none')} />
        )}
        <Text tone={TextTone.Muted}>{t('academic.tests.reportHint')}</Text>
      </Section>
      <Section title={t('academic.tests.add')}>
        <Card>
          <RecordForm fields={fields} initial={initial} submitLabel={t('academic.common.add')} onSubmit={create} />
        </Card>
      </Section>
    </View>
  );
}

export function CredentialsTab() {
  const t = useT();
  const theme = useTheme();
  const label = useEnumLabel();
  const options = useEnumOptions();
  const credentials = useCredentials();
  const actions = useAcademicActions();
  const fields: FieldSpec[] = [
    { key: 'kind', label: t('academic.fields.kind'), type: FieldType.Select, options: options('CredentialKind', Object.values(CredentialKind)) },
    { key: 'institution', label: t('academic.fields.institution'), type: FieldType.Text },
    { key: 'title', label: t('academic.fields.degree'), type: FieldType.Text },
    { key: 'scale', label: t('academic.fields.scale'), type: FieldType.Select, options: options('GradeScale', Object.values(GradeScale)) },
    { key: 'value', label: t('academic.fields.value'), type: FieldType.Text, hint: t('academic.credentials.originalHint') },
    { key: 'outOf', label: t('academic.fields.outOf'), type: FieldType.Text },
    { key: 'convertedValue', label: t('academic.fields.convertedValue'), type: FieldType.Text },
  ];
  const initial: FormValues = {
    kind: CredentialKind.Transcript,
    institution: '',
    title: '',
    scale: GradeScale.Cgpa4,
    value: '',
    outOf: '',
    convertedValue: '',
  };
  const create = (values: FormValues) =>
    actions.createCredential.mutateAsync({
      ...emptyCredentialInput(),
      kind: values.kind as CredentialKind,
      institution: textOf(values.institution),
      title: textOf(values.title),
      scale: values.scale as GradeScale,
      value: textOf(values.value),
      outOf: textOf(values.outOf),
      convertedValue: textOf(values.convertedValue),
    });
  if (credentials.isPending) {
    return <LoadingState />;
  }
  if (credentials.isError) {
    return <ErrorState onRetry={() => void credentials.refetch()} />;
  }
  return (
    <View style={{ gap: theme.space.lg }}>
      <Section title={t('academic.tabs.credentials')}>
        {credentials.data.length ? (
          <Card>
            {credentials.data.map((credential) => (
              <Item
                key={credential.id}
                title={`${credential.title} · ${credential.institution}`}
                subtitle={`${credential.value}${credential.outOf ? ` / ${credential.outOf}` : ''} (${label('GradeScale', credential.scale)})${credential.convertedValue ? ` → ${credential.convertedValue}` : ''}`}
              >
                {credential.convertedValue ? (
                  <Badge
                    label={t(credential.conversionIsEstimate ? 'academic.credentials.estimate' : 'academic.credentials.official')}
                    tone={credential.conversionIsEstimate ? StatusTone.Warning : StatusTone.Success}
                  />
                ) : null}
                <Button
                  label={t('academic.common.remove')}
                  variant={ButtonVariant.Ghost}
                  onPress={() => actions.removeCredential.mutate(credential.id)}
                />
              </Item>
            ))}
          </Card>
        ) : (
          <EmptyState title={t('academic.common.none')} />
        )}
      </Section>
      <Section title={t('academic.credentials.add')}>
        <Card>
          <RecordForm fields={fields} initial={initial} submitLabel={t('academic.common.add')} onSubmit={create} />
        </Card>
      </Section>
    </View>
  );
}

export function RefereesTab() {
  const t = useT();
  const theme = useTheme();
  const format = useFormat();
  const referees = useReferees();
  const actions = useAcademicActions();
  const [error, setError] = useState<string | undefined>();
  const fields: FieldSpec[] = [
    { key: 'name', label: t('academic.fields.name'), type: FieldType.Text },
    { key: 'email', label: t('academic.fields.email'), type: FieldType.Text },
    { key: 'title', label: t('academic.fields.degree'), type: FieldType.Text },
    { key: 'institution', label: t('academic.fields.institution'), type: FieldType.Text },
    { key: 'relationship', label: t('academic.fields.relationship'), type: FieldType.Text },
  ];
  const initial: FormValues = { name: '', email: '', title: '', institution: '', relationship: '' };
  const create = (values: FormValues) =>
    actions.createReferee.mutateAsync({
      ...emptyRefereeInput(),
      name: textOf(values.name),
      email: textOf(values.email),
      title: textOf(values.title),
      institution: textOf(values.institution),
      relationship: textOf(values.relationship),
    });
  const toggle = (id: string, confirmed: boolean) => {
    setError(undefined);
    actions.setConsent.mutate({ id, confirmed }, { onError: (failure) => setError(academicErrorKey(failure)) });
  };
  if (referees.isPending) {
    return <LoadingState />;
  }
  if (referees.isError) {
    return <ErrorState onRetry={() => void referees.refetch()} />;
  }
  return (
    <View style={{ gap: theme.space.lg }}>
      <Section title={t('academic.tabs.referees')}>
        <Text tone={TextTone.Muted}>{t('academic.referees.consentHint')}</Text>
        {error ? <Text tone={TextTone.Danger}>{t(error)}</Text> : null}
        {referees.data.length ? (
          <Card>
            {referees.data.map((referee, index) => (
              <View key={referee.id} style={{ gap: theme.space.sm }}>
                {index > 0 ? <Divider /> : null}
                <Item title={referee.name} subtitle={[referee.title, referee.institution, referee.relationship].filter(Boolean).join(' · ')}>
                  <Badge
                    label={
                      referee.consentConfirmedOn
                        ? t('academic.referees.agreed', { date: format.date(referee.consentConfirmedOn) })
                        : t('academic.referees.noConsent')
                    }
                    tone={referee.consentConfirmedOn ? StatusTone.Success : StatusTone.Warning}
                  />
                  <Button
                    label={t('academic.common.remove')}
                    variant={ButtonVariant.Ghost}
                    onPress={() => actions.removeReferee.mutate(referee.id)}
                  />
                </Item>
                <Checkbox
                  checked={referee.consentConfirmedOn !== undefined}
                  onChange={(checked) => toggle(referee.id, checked)}
                  accessibilityLabel={`${referee.name} ${t('academic.referees.consent')}`}
                >
                  <Text>{t('academic.referees.consent')}</Text>
                </Checkbox>
              </View>
            ))}
          </Card>
        ) : (
          <EmptyState title={t('academic.common.none')} />
        )}
      </Section>
      <Section title={t('academic.referees.add')}>
        <Card>
          <RecordForm fields={fields} initial={initial} submitLabel={t('academic.common.add')} onSubmit={create} />
        </Card>
      </Section>
    </View>
  );
}
