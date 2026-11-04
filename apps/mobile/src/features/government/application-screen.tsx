import { useState } from 'react';
import { Linking, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ApiErrorDetail, isApiError, type GovApplication, type SecretValues, type StageInput } from '@careerpilot/api-client';
import {
  canMarkSubmitted,
  enumLabelKey,
  urgencyKey,
  useFormat,
  useGovApplication,
  useGovApplicationActions,
  useGovGuide,
  useGovernmentReference,
  useT,
  useWithdrawGovApplication,
} from '@careerpilot/client-core';
import { FeeStatus, GovApplicationStatus, GovStage, GuideActor, PaymentMethod, SecretKind, StageStatus, StatusTone } from '@careerpilot/domain-ui-logic';
import { useTheme } from '@/core/theme/theme';
import { Routes } from '@/core/navigation/routes';
import { Badge, Button, ButtonVariant, Card, ErrorState, LoadingState, Screen, Section, SelectField, SnackbarTone, Text, TextField, TextTone, TextVariant, useSnackbar } from '@/ui';
import { pickDocument } from '@/features/profile/profile-support';

const NONE = '';
const ENTRY_KINDS: SecretKind[] = [SecretKind.ApplicationId, SecretKind.UserId, SecretKind.Password, SecretKind.RollNumber];
const EMPTY_STAGE: StageInput = { stage: GovStage.Written, status: StageStatus.Scheduled };

function options(enumKey: string, values: readonly string[], t: (key: string) => string) {
  return values.map((value) => ({ value, label: t(enumLabelKey(enumKey, value)) }));
}

function useFailure() {
  const t = useT();
  const snackbar = useSnackbar();
  return (error: unknown) => {
    const detail = isApiError(error) ? error.detail : undefined;
    const known = detail === ApiErrorDetail.EvidenceRequired || detail === ApiErrorDetail.NotPreparing || detail === ApiErrorDetail.NotSubmitted;
    snackbar.show({ message: t(known ? `government.errors.${detail}` : 'government.errors.generic'), tone: SnackbarTone.Danger });
  };
}

function Guide({ id }: { id: string }) {
  const t = useT();
  const theme = useTheme();
  const guide = useGovGuide(id);
  return (
    <Section title={t('government.application.guide')}>
      <Text tone={TextTone.Muted}>{t('government.application.guideBody')}</Text>
      <Card>
        {guide.data?.map((step) => (
          <View key={step.kind} style={{ gap: theme.space.xs }}>
            <Text variant={TextVariant.Subheading}>
              {step.done ? '✓ ' : ''}
              {t(enumLabelKey('guide_step_kind', step.kind))}
            </Text>
            <Badge label={step.actor === GuideActor.User ? t('government.application.you') : t('government.application.system')} />
            {step.link ? <Button label={t('government.application.openSite')} variant={ButtonVariant.Secondary} onPress={() => void Linking.openURL(step.link)} /> : null}
          </View>
        ))}
      </Card>
    </Section>
  );
}

function Fee({ application }: { application: GovApplication }) {
  const t = useT();
  const format = useFormat();
  const actions = useGovApplicationActions(application.id);
  const failed = useFailure();
  const [evidence, setEvidence] = useState(application.fee.evidenceNote);
  const [transaction, setTransaction] = useState('');
  const [method, setMethod] = useState<string>(application.fee.method ?? NONE);
  const fee = application.fee;
  const urgency = urgencyKey(application.feeUrgency);
  const save = (status: FeeStatus) =>
    actions.fee.mutate({ status, method: method ? (method as PaymentMethod) : undefined, evidenceNote: evidence, transactionId: transaction || undefined }, { onError: failed });
  return (
    <Section title={t('government.application.fee')}>
      <Card>
        <Text variant={TextVariant.Subheading}>{fee.amount !== undefined ? t('government.application.feeAmount', { amount: fee.amount, currency: fee.currency }) : t(enumLabelKey('fee_status', fee.status))}</Text>
        <Badge label={t(enumLabelKey('fee_status', fee.status))} tone={fee.status === FeeStatus.Paid ? StatusTone.Success : StatusTone.Neutral} />
        {urgency ? <Badge label={t(urgency)} tone={StatusTone.Warning} /> : null}
        {fee.paymentDeadline ? <Text>{t('government.application.deadline', { date: format.dateTime(fee.paymentDeadline) })}</Text> : null}
        {fee.status !== FeeStatus.NotRequired ? (
          <>
            <SelectField
              label={t('government.application.method')}
              value={method}
              placeholder={t('government.application.method')}
              options={options('payment_method', Object.values(PaymentMethod), t)}
              onChange={setMethod}
            />
            <TextField label={t('government.application.evidence')} hint={t('government.application.evidenceHint')} value={evidence} onChangeText={setEvidence} />
            <TextField label={t('government.application.transaction')} secret value={transaction} onChangeText={setTransaction} />
            <Button label={t('government.application.markUnconfirmed')} variant={ButtonVariant.Secondary} onPress={() => save(FeeStatus.Unconfirmed)} loading={actions.fee.isPending} fullWidth />
            <Button label={t('government.application.markPaid')} onPress={() => save(FeeStatus.Paid)} loading={actions.fee.isPending} fullWidth testID="government-mark-paid" />
          </>
        ) : null}
      </Card>
    </Section>
  );
}

function Stages({ application }: { application: GovApplication }) {
  const t = useT();
  const format = useFormat();
  const actions = useGovApplicationActions(application.id);
  const failed = useFailure();
  const [draft, setDraft] = useState<StageInput>(EMPTY_STAGE);
  return (
    <Section title={t('government.application.stages')}>
      <Card>
        {application.stages.map((stage) => (
          <View key={stage.id}>
            <Text variant={TextVariant.Subheading}>{t(enumLabelKey('gov_stage', stage.stage))}</Text>
            <Text tone={TextTone.Muted}>
              {[stage.on ? format.date(stage.on) : undefined, stage.time, stage.venue, t(enumLabelKey('stage_status', stage.status))].filter(Boolean).join(' · ')}
            </Text>
            <Button label={t('government.application.remove')} variant={ButtonVariant.Secondary} onPress={() => actions.removeStage.mutate(stage.id)} />
          </View>
        ))}
      </Card>
      <Card>
        <Text variant={TextVariant.Subheading}>{t('government.application.addStage')}</Text>
        <SelectField
          label={t('government.application.stage')}
          value={draft.stage}
          placeholder={t('government.application.stage')}
          options={options('gov_stage', Object.values(GovStage), t)}
          onChange={(value) => setDraft({ ...draft, stage: value as GovStage })}
        />
        <SelectField
          label={t('government.application.stageStatus')}
          value={draft.status}
          placeholder={t('government.application.stageStatus')}
          options={options('stage_status', Object.values(StageStatus), t)}
          onChange={(value) => setDraft({ ...draft, status: value as StageStatus })}
        />
        <TextField label={t('government.application.date')} hint="YYYY-MM-DD" value={draft.on ?? ''} onChangeText={(value) => setDraft({ ...draft, on: value || undefined })} />
        <TextField label={t('government.application.venue')} value={draft.venue ?? ''} onChangeText={(value) => setDraft({ ...draft, venue: value })} />
        <TextField label={t('government.application.noticeLink')} value={draft.noticeUrl ?? ''} onChangeText={(value) => setDraft({ ...draft, noticeUrl: value })} />
        <Button
          label={t('government.application.save')}
          onPress={() => actions.addStage.mutate({ ...draft, source: undefined }, { onSuccess: () => setDraft(EMPTY_STAGE), onError: failed })}
          loading={actions.addStage.isPending}
          fullWidth
        />
      </Card>
    </Section>
  );
}

function Copies({ application }: { application: GovApplication }) {
  const t = useT();
  const actions = useGovApplicationActions(application.id);
  const failed = useFailure();
  const reference = useGovernmentReference().data;
  const upload = async () => {
    const file = await pickDocument(reference?.copyTypes ?? []);
    if (file) {
      actions.addCopy.mutate(file, { onError: failed });
    }
  };
  return (
    <Section title={t('government.application.copies')}>
      <Card>
        {application.copies.length === 0 ? <Text tone={TextTone.Muted}>{t('government.application.noCopies')}</Text> : null}
        {application.copies.map((copy) => (
          <View key={copy.id}>
            <Text onPress={() => void Linking.openURL(copy.url)}>{copy.fileName}</Text>
            <Button label={t('government.application.remove')} variant={ButtonVariant.Secondary} onPress={() => actions.removeCopy.mutate(copy.id)} />
          </View>
        ))}
        <Button label={t('government.application.addCopy')} onPress={() => void upload()} loading={actions.addCopy.isPending} fullWidth />
        <Text tone={TextTone.Muted}>{t('government.application.copyHint')}</Text>
      </Card>
    </Section>
  );
}

function Credentials({ application }: { application: GovApplication }) {
  const t = useT();
  const actions = useGovApplicationActions(application.id);
  const [values, setValues] = useState<SecretValues>({});
  const [shown, setShown] = useState<SecretValues | undefined>();
  const kinds = application.secretsPresent.includes(SecretKind.TransactionId) ? [...ENTRY_KINDS, SecretKind.TransactionId] : ENTRY_KINDS;
  return (
    <Section title={t('government.application.credentials')}>
      <Card>
        <Text tone={TextTone.Muted}>{t('government.application.credentialsBody')}</Text>
        {kinds.map((kind) => (
          <TextField
            key={kind}
            label={t(enumLabelKey('secret_kind', kind))}
            hint={application.secretsPresent.includes(kind) ? t('government.application.savedSecret') : t('government.application.enterSecret')}
            secret
            value={values[kind] ?? ''}
            onChangeText={(value) => setValues({ ...values, [kind]: value })}
          />
        ))}
        <Button label={t('government.application.save')} onPress={() => actions.setSecrets.mutate(values, { onSuccess: () => setValues({}) })} loading={actions.setSecrets.isPending} fullWidth />
        <Button
          label={shown ? t('government.application.hide') : t('government.application.reveal')}
          variant={ButtonVariant.Secondary}
          onPress={() => (shown ? setShown(undefined) : actions.reveal.mutate(undefined, { onSuccess: setShown }))}
          fullWidth
        />
        {shown
          ? Object.entries(shown).map(([kind, value]) => (
              <Text key={kind}>
                {t(enumLabelKey('secret_kind', kind))}: {value}
              </Text>
            ))
          : null}
      </Card>
    </Section>
  );
}

export function GovApplicationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useT();
  const router = useRouter();
  const application = useGovApplication(id);
  const actions = useGovApplicationActions(id);
  const withdraw = useWithdrawGovApplication();
  const failed = useFailure();
  const [confirming, setConfirming] = useState(false);
  if (application.isPending) {
    return <LoadingState />;
  }
  if (application.isError) {
    return <ErrorState onRetry={() => void application.refetch()} />;
  }
  const a = application.data;
  return (
    <Screen testID="government-application-screen">
      <Text variant={TextVariant.Heading}>{a.circularTitle}</Text>
      <Text tone={TextTone.Muted}>
        {a.authority} · {t(enumLabelKey('gov_application_status', a.status))}
      </Text>
      <Text>{a.postTitles.join(', ')}</Text>
      {canMarkSubmitted(a) ? <Button label={t('government.application.markSubmitted')} onPress={() => actions.submitted.mutate(undefined, { onError: failed })} loading={actions.submitted.isPending} fullWidth /> : null}
      {a.status === GovApplicationStatus.Submitted ? (
        <>
          <Button label={t('government.application.confirm')} onPress={() => actions.confirm.mutate(undefined, { onError: failed })} loading={actions.confirm.isPending} fullWidth />
          <Text tone={TextTone.Muted}>{t('government.application.confirmHint')}</Text>
        </>
      ) : null}
      <Guide id={id} />
      <Fee application={a} />
      <Stages application={a} />
      <Copies application={a} />
      <Credentials application={a} />
      {confirming ? (
        <Card>
          <Text>{t('government.application.withdrawConfirm')}</Text>
          <Button label={t('government.application.withdraw')} variant={ButtonVariant.Destructive} onPress={() => withdraw.mutate(id, { onSuccess: () => router.replace(Routes.government) })} fullWidth />
          <Button label={t('common.cancel')} variant={ButtonVariant.Secondary} onPress={() => setConfirming(false)} fullWidth />
        </Card>
      ) : (
        <Button label={t('government.application.withdraw')} variant={ButtonVariant.Secondary} onPress={() => setConfirming(true)} fullWidth />
      )}
    </Screen>
  );
}
