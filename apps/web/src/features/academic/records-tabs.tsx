'use client';

import { useState } from 'react';
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
import { AmountSource, CredentialKind, ExamKind, ExamStatus, GradeScale } from '@careerpilot/domain-ui-logic';
import { emptyCredentialInput, emptyExamInput, emptyRefereeInput } from '@careerpilot/api-client';
import { Badge, Button, Card, Checkbox, EmptyState, ErrorState, LoadingState, Section } from '@careerpilot/ui-web';
import { StatusTone } from '@careerpilot/domain-ui-logic';
import { useEnumLabel, useEnumOptions } from './academic-parts';
import { dayOrUndefined, FieldType, numberOrUndefined, RecordForm, textOf, type FieldSpec, type FormValues } from './record-form';

function Row({ title, subtitle, trailing }: { title: string; subtitle?: string; trailing: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border py-2 last:border-0">
      <div>
        <p className="font-medium">{title}</p>
        {subtitle ? <p className="text-sm text-muted">{subtitle}</p> : null}
      </div>
      <div className="flex flex-wrap items-center gap-2">{trailing}</div>
    </div>
  );
}

export function TestsTab() {
  const t = useT();
  const format = useFormat();
  const label = useEnumLabel();
  const options = useEnumOptions();
  const exams = useExams();
  const actions = useAcademicActions();
  const fields: FieldSpec[] = [
    { key: 'exam', label: t('academic.fields.exam'), type: FieldType.Select, options: options('ExamKind', Object.values(ExamKind)) },
    { key: 'status', label: t('academic.fields.testStatus'), type: FieldType.Select, options: options('ExamStatus', Object.values(ExamStatus)) },
    { key: 'registrationDeadline', label: t('academic.fields.registrationDeadline'), type: FieldType.Date },
    { key: 'testOn', label: t('academic.fields.testOn'), type: FieldType.Date },
    { key: 'scoreReleaseOn', label: t('academic.fields.scoreReleaseOn'), type: FieldType.Date },
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
  if (exams.isLoading) {
    return <LoadingState />;
  }
  if (exams.isError) {
    return <ErrorState onRetry={() => void exams.refetch()} />;
  }
  return (
    <div className="flex flex-col gap-6">
      <Section title={t('academic.tabs.tests')}>
        {exams.data?.length ? (
          <Card>
            {examsExpiringFirst(exams.data).map((exam) => (
              <Row
                key={exam.id}
                title={`${label('ExamKind', exam.exam)} · ${label('ExamStatus', exam.status)}`}
                subtitle={[
                  exam.testOn ? format.date(exam.testOn) : undefined,
                  exam.scores?.overall !== undefined ? String(exam.scores.overall) : undefined,
                  exam.expiresOn ? t('academic.tests.expires', { date: format.date(exam.expiresOn) }) : t('academic.tests.expiresUnknown'),
                ]
                  .filter(Boolean)
                  .join(' · ')}
                trailing={
                  <Button size="sm" variant="ghost" onClick={() => actions.removeExam.mutate(exam.id)}>
                    {t('academic.common.remove')}
                  </Button>
                }
              />
            ))}
          </Card>
        ) : (
          <EmptyState title={t('academic.common.none')} />
        )}
        <p className="text-sm text-muted">{t('academic.tests.reportHint')}</p>
      </Section>
      <Section title={t('academic.tests.add')}>
        <Card>
          <RecordForm fields={fields} initial={initial} submitLabel={t('academic.common.add')} onSubmit={create} />
        </Card>
      </Section>
    </div>
  );
}

export function CredentialsTab() {
  const t = useT();
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
  if (credentials.isLoading) {
    return <LoadingState />;
  }
  if (credentials.isError) {
    return <ErrorState onRetry={() => void credentials.refetch()} />;
  }
  return (
    <div className="flex flex-col gap-6">
      <Section title={t('academic.tabs.credentials')}>
        {credentials.data?.length ? (
          <Card>
            {credentials.data.map((credential) => (
              <Row
                key={credential.id}
                title={`${credential.title} · ${credential.institution}`}
                subtitle={`${credential.value}${credential.outOf ? ` / ${credential.outOf}` : ''} (${label('GradeScale', credential.scale)})${credential.convertedValue ? ` → ${credential.convertedValue}` : ''}`}
                trailing={
                  <>
                    {credential.convertedValue ? (
                      <Badge
                        label={t(credential.conversionIsEstimate ? 'academic.credentials.estimate' : 'academic.credentials.official')}
                        tone={credential.conversionIsEstimate ? StatusTone.Warning : StatusTone.Success}
                      />
                    ) : null}
                    <Button size="sm" variant="ghost" onClick={() => actions.removeCredential.mutate(credential.id)}>
                      {t('academic.common.remove')}
                    </Button>
                  </>
                }
              />
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
    </div>
  );
}

export function RefereesTab() {
  const t = useT();
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
  if (referees.isLoading) {
    return <LoadingState />;
  }
  if (referees.isError) {
    return <ErrorState onRetry={() => void referees.refetch()} />;
  }
  return (
    <div className="flex flex-col gap-6">
      <Section title={t('academic.tabs.referees')}>
        <p className="text-sm text-muted">{t('academic.referees.consentHint')}</p>
        {error ? (
          <p role="alert" className="text-sm text-danger">
            {t(error)}
          </p>
        ) : null}
        {referees.data?.length ? (
          <Card>
            {referees.data.map((referee) => (
              <div key={referee.id} className="flex flex-col gap-2 border-b border-border py-2 last:border-0">
                <Row
                  title={referee.name}
                  subtitle={[referee.title, referee.institution, referee.relationship].filter(Boolean).join(' · ')}
                  trailing={
                    <>
                      <Badge
                        label={
                          referee.consentConfirmedOn
                            ? t('academic.referees.agreed', { date: format.date(referee.consentConfirmedOn) })
                            : t('academic.referees.noConsent')
                        }
                        tone={referee.consentConfirmedOn ? StatusTone.Success : StatusTone.Warning}
                      />
                      <Button size="sm" variant="ghost" onClick={() => actions.removeReferee.mutate(referee.id)}>
                        {t('academic.common.remove')}
                      </Button>
                    </>
                  }
                />
                <Checkbox checked={referee.consentConfirmedOn !== undefined} onChange={(checked) => toggle(referee.id, checked)}>
                  {t('academic.referees.consent')}
                </Checkbox>
              </div>
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
    </div>
  );
}
