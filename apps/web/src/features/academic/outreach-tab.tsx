'use client';

import { useState } from 'react';
import {
  academicErrorKey,
  useAcademicActions,
  useAcademicReference,
  useFormat,
  useOutreach,
  useOutreachSettings,
  useT,
} from '@careerpilot/client-core';
import { OutreachStatus, ReplyOutcome, StatusTone } from '@careerpilot/domain-ui-logic';
import { emptyOutreachDraft, type Outreach } from '@careerpilot/api-client';
import { Badge, Button, Card, EmptyState, ErrorState, LoadingState, Section, TextField } from '@careerpilot/ui-web';
import { useEnumLabel } from './academic-parts';
import { FieldType, RecordForm, textOf, type FieldSpec, type FormValues } from './record-form';

const REPLIES: Array<{ outcome: ReplyOutcome; key: string }> = [
  { outcome: ReplyOutcome.Positive, key: 'replyPositive' },
  { outcome: ReplyOutcome.CallRequested, key: 'replyCall' },
  { outcome: ReplyOutcome.DocumentsRequested, key: 'replyDocs' },
  { outcome: ReplyOutcome.Neutral, key: 'replyNeutral' },
  { outcome: ReplyOutcome.Declined, key: 'replyDeclined' },
  { outcome: ReplyOutcome.DoNotContact, key: 'replyStop' },
];
const ATTENTION: readonly OutreachStatus[] = [OutreachStatus.RepliedPositive, OutreachStatus.CallRequested, OutreachStatus.DocumentsRequested];

function OutreachCard({ item }: { item: Outreach }) {
  const t = useT();
  const format = useFormat();
  const label = useEnumLabel();
  const actions = useAcademicActions();
  const [body, setBody] = useState(item.body);
  const [error, setError] = useState<string | undefined>();
  const run = (promise: Promise<unknown>) => {
    setError(undefined);
    promise.catch((failure: unknown) => setError(academicErrorKey(failure)));
  };
  const { id, subject, supervisorName, university, department, researchReference, supervisorEmail, sourceUrl, programId, allowFollowUp } = item;
  const save = () =>
    actions.updateOutreach.mutateAsync({
      id,
      input: { supervisorName, university, department, researchReference, supervisorEmail, sourceUrl, programId, allowFollowUp, subject, body },
    });
  const draft = item.status === OutreachStatus.Draft;
  return (
    <Card className="gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-semibold">
          {supervisorName} · {university}
        </p>
        <Badge label={label('OutreachStatus', item.status)} tone={ATTENTION.includes(item.status) ? StatusTone.Warning : StatusTone.Neutral} />
      </div>
      <p className="text-sm text-muted">
        {subject}
        {item.sentOn ? ` · ${t('academic.outreach.sentOn', { date: format.date(item.sentOn) })}` : ''}
      </p>
      {item.doNotContact ? <p className="text-sm text-danger">{t('academic.outreach.stopped')}</p> : null}
      <TextField
        label={t('academic.outreach.bodyLabel')}
        value={body}
        onChange={(event) => setBody(event.target.value)}
        onBlur={() => body !== item.body && run(save())}
      />
      <p className="text-sm text-muted">{t('academic.outreach.draftHint')}</p>
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {t(error)}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {!item.doNotContact ? (
          <Button size="sm" onClick={() => run(save().then(() => actions.markSent.mutateAsync(id)))}>
            {t(draft ? 'academic.outreach.markSent' : 'academic.outreach.followUp')}
          </Button>
        ) : null}
        {!draft
          ? REPLIES.map((reply) => (
              <Button
                key={reply.outcome}
                size="sm"
                variant="outline"
                onClick={() => run(actions.recordReply.mutateAsync({ id, outcome: reply.outcome }))}
              >
                {t(`academic.outreach.${reply.key}`)}
              </Button>
            ))
          : null}
        <Button size="sm" variant="ghost" onClick={() => run(actions.removeOutreach.mutateAsync(id))}>
          {t('academic.common.remove')}
        </Button>
      </div>
    </Card>
  );
}

function LimitsCard() {
  const t = useT();
  const reference = useAcademicReference();
  const settings = useOutreachSettings();
  const actions = useAcademicActions();
  if (!reference.data || !settings.data) {
    return null;
  }
  const limits = [
    { key: 'maxPerDay', value: settings.data.maxPerDay ?? reference.data.maxPerDay, max: reference.data.maxPerDay },
    { key: 'maxPerDepartment', value: settings.data.maxPerDepartment ?? reference.data.maxPerDepartment, max: reference.data.maxPerDepartment },
    { key: 'maxPerUniversity', value: settings.data.maxPerUniversity ?? reference.data.maxPerUniversity, max: reference.data.maxPerUniversity },
  ] as const;
  return (
    <Card className="grid gap-3 md:grid-cols-3">
      {limits.map((limit) => (
        <TextField
          key={limit.key}
          type="number"
          min={1}
          max={limit.max}
          label={t(`academic.fields.${limit.key}`)}
          defaultValue={limit.value}
          onBlur={(event) => {
            const next = Number(event.target.value);
            if (next >= 1 && next <= limit.max && next !== limit.value) {
              actions.updateSettings.mutate({ ...settings.data, [limit.key]: next });
            }
          }}
        />
      ))}
      <p className="text-sm text-muted md:col-span-3">{t('academic.outreach.limitsHint')}</p>
    </Card>
  );
}

export function OutreachTab() {
  const t = useT();
  const outreach = useOutreach();
  const actions = useAcademicActions();
  const fields: FieldSpec[] = [
    { key: 'supervisorName', label: t('academic.fields.supervisorName'), type: FieldType.Text },
    { key: 'supervisorEmail', label: t('academic.fields.supervisorEmail'), type: FieldType.Text },
    { key: 'university', label: t('academic.fields.university'), type: FieldType.Text },
    { key: 'department', label: t('academic.fields.department'), type: FieldType.Text },
    { key: 'researchReference', label: t('academic.fields.researchReference'), type: FieldType.Area },
    { key: 'sourceUrl', label: t('academic.common.sourceLink'), type: FieldType.Text },
  ];
  const initial: FormValues = { supervisorName: '', supervisorEmail: '', university: '', department: '', researchReference: '', sourceUrl: '' };
  const create = (values: FormValues) =>
    actions.draftOutreach.mutateAsync({
      ...emptyOutreachDraft(),
      supervisorName: textOf(values.supervisorName),
      supervisorEmail: textOf(values.supervisorEmail),
      university: textOf(values.university),
      department: textOf(values.department),
      researchReference: textOf(values.researchReference),
      sourceUrl: textOf(values.sourceUrl),
    });
  if (outreach.isLoading) {
    return <LoadingState />;
  }
  if (outreach.isError) {
    return <ErrorState onRetry={() => void outreach.refetch()} />;
  }
  return (
    <div className="flex flex-col gap-6">
      <Section title={t('academic.outreach.limits')}>
        <LimitsCard />
      </Section>
      <Section title={t('academic.tabs.outreach')}>
        {outreach.data?.length ? (
          outreach.data.map((item) => <OutreachCard key={item.id} item={item} />)
        ) : (
          <EmptyState title={t('academic.common.none')} />
        )}
      </Section>
      <Section title={t('academic.outreach.draft')}>
        <p className="text-sm text-muted">{t('academic.outreach.draftHint')}</p>
        <Card>
          <RecordForm fields={fields} initial={initial} submitLabel={t('academic.outreach.draft')} onSubmit={create} />
        </Card>
      </Section>
    </div>
  );
}
