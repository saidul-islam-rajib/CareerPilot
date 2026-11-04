import { useState } from 'react';
import { View } from 'react-native';
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
import { useTheme } from '@/core/theme/theme';
import { Badge, Button, ButtonVariant, Card, EmptyState, ErrorState, LoadingState, Section, Text, TextField, TextTone, TextVariant } from '@/ui';
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
  const theme = useTheme();
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
    <Card>
      <Text variant={TextVariant.Subheading}>
        {supervisorName} · {university}
      </Text>
      <Badge label={label('OutreachStatus', item.status)} tone={ATTENTION.includes(item.status) ? StatusTone.Warning : StatusTone.Neutral} />
      <Text tone={TextTone.Muted}>
        {subject}
        {item.sentOn ? ` · ${t('academic.outreach.sentOn', { date: format.date(item.sentOn) })}` : ''}
      </Text>
      {item.doNotContact ? <Text tone={TextTone.Danger}>{t('academic.outreach.stopped')}</Text> : null}
      <TextField
        label={t('academic.outreach.bodyLabel')}
        value={body}
        multiline
        onChangeText={setBody}
        onBlur={() => body !== item.body && run(save())}
      />
      <Text tone={TextTone.Muted}>{t('academic.outreach.draftHint')}</Text>
      {error ? <Text tone={TextTone.Danger}>{t(error)}</Text> : null}
      <View style={{ gap: theme.space.sm }}>
        {!item.doNotContact ? (
          <Button
            label={t(draft ? 'academic.outreach.markSent' : 'academic.outreach.followUp')}
            onPress={() => run(save().then(() => actions.markSent.mutateAsync(id)))}
          />
        ) : null}
        {!draft
          ? REPLIES.map((reply) => (
              <Button
                key={reply.outcome}
                label={t(`academic.outreach.${reply.key}`)}
                variant={ButtonVariant.Outline}
                onPress={() => run(actions.recordReply.mutateAsync({ id, outcome: reply.outcome }))}
              />
            ))
          : null}
        <Button label={t('academic.common.remove')} variant={ButtonVariant.Ghost} onPress={() => run(actions.removeOutreach.mutateAsync(id))} />
      </View>
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
    <Card>
      {limits.map((limit) => (
        <TextField
          key={limit.key}
          label={t(`academic.fields.${limit.key}`)}
          keyboardType="numeric"
          defaultValue={String(limit.value)}
          onEndEditing={(event) => {
            const next = Number(event.nativeEvent.text);
            if (next >= 1 && next <= limit.max && next !== limit.value) {
              actions.updateSettings.mutate({ ...settings.data, [limit.key]: next });
            }
          }}
        />
      ))}
      <Text tone={TextTone.Muted}>{t('academic.outreach.limitsHint')}</Text>
    </Card>
  );
}

export function OutreachTab() {
  const t = useT();
  const theme = useTheme();
  const outreach = useOutreach();
  const actions = useAcademicActions();
  const fields: FieldSpec[] = [
    { key: 'supervisorName', label: t('academic.fields.supervisorName'), type: FieldType.Text },
    { key: 'supervisorEmail', label: t('academic.fields.supervisorEmail'), type: FieldType.Text },
    { key: 'university', label: t('academic.fields.university'), type: FieldType.Text },
    { key: 'department', label: t('academic.fields.department'), type: FieldType.Text },
    { key: 'researchReference', label: t('academic.fields.researchReference'), type: FieldType.Text },
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
  if (outreach.isPending) {
    return <LoadingState />;
  }
  if (outreach.isError) {
    return <ErrorState onRetry={() => void outreach.refetch()} />;
  }
  return (
    <View style={{ gap: theme.space.lg }}>
      <Section title={t('academic.outreach.limits')}>
        <LimitsCard />
      </Section>
      <Section title={t('academic.tabs.outreach')}>
        {outreach.data.length ? (
          outreach.data.map((item) => <OutreachCard key={item.id} item={item} />)
        ) : (
          <EmptyState title={t('academic.common.none')} />
        )}
      </Section>
      <Section title={t('academic.outreach.draft')}>
        <Text tone={TextTone.Muted}>{t('academic.outreach.draftHint')}</Text>
        <Card>
          <RecordForm fields={fields} initial={initial} submitLabel={t('academic.outreach.draft')} onSubmit={create} />
        </Card>
      </Section>
    </View>
  );
}
