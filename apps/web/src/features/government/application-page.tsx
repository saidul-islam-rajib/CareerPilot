'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { CircleCheck, Circle, ExternalLink } from 'lucide-react';
import type { GovApplication, SecretValues, StageInput } from '@careerpilot/api-client';
import { ApiErrorDetail, isApiError } from '@careerpilot/api-client';
import {
  canMarkSubmitted,
  urgencyKey,
  useFormat,
  useGovApplication,
  useGovApplicationActions,
  useGovGuide,
  useGovernmentReference,
  useT,
  useWithdrawGovApplication,
} from '@careerpilot/client-core';
import { EvidenceSource, FeeStatus, GovApplicationStatus, GovStage, GuideActor, PaymentMethod, SecretKind, StageStatus, StatusTone } from '@careerpilot/domain-ui-logic';
import { Badge, Button, Card, ConfirmDialog, ErrorState, FileDropZone, LoadingState, PageHeader, Section, SelectField, TextField, useToast } from '@careerpilot/ui-web';
import { Routes } from '@/core/routes';
import { DayNote, enumLabelKey } from './government-parts';

const NONE = '';
const ENTRY_KINDS: SecretKind[] = [SecretKind.ApplicationId, SecretKind.UserId, SecretKind.Password, SecretKind.RollNumber];

function labelOf(enumKey: string, values: readonly string[], t: (key: string) => string) {
  return values.map((value) => ({ value, label: t(enumLabelKey(enumKey, value)) }));
}

function useFailure() {
  const t = useT();
  const toast = useToast();
  return (error: unknown) => {
    const detail = isApiError(error) ? error.detail : undefined;
    const known = detail === ApiErrorDetail.EvidenceRequired || detail === ApiErrorDetail.NotPreparing || detail === ApiErrorDetail.NotSubmitted;
    toast.show({ message: t(known ? `government.errors.${detail}` : 'government.errors.generic') });
  };
}

function GuideSection({ id }: { id: string }) {
  const t = useT();
  const guide = useGovGuide(id);
  return (
    <Section title={t('government.application.guide')}>
      <p className="text-sm text-muted">{t('government.application.guideBody')}</p>
      <Card>
        <ol className="flex flex-col gap-2">
          {guide.data?.map((step) => (
            <li key={step.kind} className="flex items-center gap-3">
              {step.done ? <CircleCheck className="size-5 text-success" aria-hidden /> : <Circle className="size-5 text-muted" aria-hidden />}
              <span className="flex-1">{t(enumLabelKey('guide_step_kind', step.kind))}</span>
              <Badge label={step.actor === GuideActor.User ? t('government.application.you') : t('government.application.system')} />
              {step.link ? (
                <a className="inline-flex items-center gap-1 text-primary underline" href={step.link} target="_blank" rel="noreferrer">
                  {t('government.application.openSite')}
                  <ExternalLink className="size-4" aria-hidden />
                </a>
              ) : null}
            </li>
          ))}
        </ol>
      </Card>
    </Section>
  );
}

function FeeSection({ application }: { application: GovApplication }) {
  const t = useT();
  const format = useFormat();
  const actions = useGovApplicationActions(application.id);
  const failed = useFailure();
  const [evidence, setEvidence] = useState(application.fee.evidenceNote);
  const [transaction, setTransaction] = useState('');
  const [method, setMethod] = useState<string>(application.fee.method ?? NONE);
  const urgency = urgencyKey(application.feeUrgency);
  const save = (status: FeeStatus) =>
    actions.fee.mutate(
      { status, method: method ? (method as PaymentMethod) : undefined, evidenceNote: evidence, transactionId: transaction || undefined },
      { onError: failed },
    );
  const fee = application.fee;
  return (
    <Section title={t('government.application.fee')}>
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-medium">{fee.amount !== undefined ? t('government.application.feeAmount', { amount: fee.amount, currency: fee.currency }) : t(enumLabelKey('fee_status', fee.status))}</p>
          <div className="flex gap-2">
            <Badge label={t(enumLabelKey('fee_status', fee.status))} tone={fee.status === FeeStatus.Paid ? StatusTone.Success : StatusTone.Neutral} />
            {urgency ? <Badge label={t(urgency)} tone={StatusTone.Warning} /> : null}
          </div>
        </div>
        {fee.paymentDeadline ? <p className="text-sm">{t('government.application.deadline', { date: format.dateTime(fee.paymentDeadline) })}</p> : null}
        <DayNote note={application.feeNote} />
        {fee.status !== FeeStatus.NotRequired ? (
          <>
            <SelectField
              label={t('government.application.method')}
              value={method}
              options={[{ value: NONE, label: '' }, ...labelOf('payment_method', Object.values(PaymentMethod), t)]}
              onValueChange={setMethod}
            />
            <TextField label={t('government.application.evidence')} hint={t('government.application.evidenceHint')} value={evidence} onChange={(event) => setEvidence(event.target.value)} />
            <TextField label={t('government.application.transaction')} secret value={transaction} onChange={(event) => setTransaction(event.target.value)} />
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => save(FeeStatus.Unconfirmed)} loading={actions.fee.isPending}>
                {t('government.application.markUnconfirmed')}
              </Button>
              <Button onClick={() => save(FeeStatus.Paid)} loading={actions.fee.isPending}>
                {t('government.application.markPaid')}
              </Button>
            </div>
          </>
        ) : null}
      </Card>
    </Section>
  );
}

const EMPTY_STAGE: StageInput = { stage: GovStage.Written, status: StageStatus.Scheduled };

function StagesSection({ application }: { application: GovApplication }) {
  const t = useT();
  const format = useFormat();
  const actions = useGovApplicationActions(application.id);
  const failed = useFailure();
  const [draft, setDraft] = useState<StageInput>(EMPTY_STAGE);
  const add = () => actions.addStage.mutate({ ...draft, source: draft.noticeUrl ? EvidenceSource.OfficialNotice : EvidenceSource.UserEntry }, { onSuccess: () => setDraft(EMPTY_STAGE), onError: failed });
  return (
    <Section title={t('government.application.stages')}>
      <Card>
        {application.stages.map((stage) => (
          <div key={stage.id} className="flex flex-wrap items-center justify-between gap-2 py-1">
            <div>
              <p className="font-medium">{t(enumLabelKey('gov_stage', stage.stage))}</p>
              <p className="text-sm text-muted">
                {[stage.on ? format.date(stage.on) : undefined, stage.time, stage.venue, t(enumLabelKey('evidence_source', stage.source))].filter(Boolean).join(' · ')}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge label={t(enumLabelKey('stage_status', stage.status))} />
              <Button variant="ghost" onClick={() => actions.removeStage.mutate(stage.id)}>
                {t('government.application.remove')}
              </Button>
            </div>
          </div>
        ))}
      </Card>
      <Card className="gap-3">
        <p className="font-medium">{t('government.application.addStage')}</p>
        <SelectField
          label={t('government.application.stage')}
          value={draft.stage}
          options={labelOf('gov_stage', Object.values(GovStage), t)}
          onValueChange={(value) => setDraft({ ...draft, stage: value as GovStage })}
        />
        <SelectField
          label={t('government.application.stageStatus')}
          value={draft.status}
          options={labelOf('stage_status', Object.values(StageStatus), t)}
          onValueChange={(value) => setDraft({ ...draft, status: value as StageStatus })}
        />
        <TextField label={t('government.application.date')} type="date" value={draft.on ?? ''} onChange={(event) => setDraft({ ...draft, on: event.target.value || undefined })} />
        <TextField label={t('government.application.time')} type="time" value={draft.time ?? ''} onChange={(event) => setDraft({ ...draft, time: event.target.value || undefined })} />
        <TextField label={t('government.application.venue')} value={draft.venue ?? ''} onChange={(event) => setDraft({ ...draft, venue: event.target.value })} />
        <TextField label={t('government.application.noticeLink')} value={draft.noticeUrl ?? ''} onChange={(event) => setDraft({ ...draft, noticeUrl: event.target.value })} />
        <div>
          <Button onClick={add} loading={actions.addStage.isPending}>
            {t('government.application.save')}
          </Button>
        </div>
      </Card>
    </Section>
  );
}

function CopiesSection({ application }: { application: GovApplication }) {
  const t = useT();
  const actions = useGovApplicationActions(application.id);
  const failed = useFailure();
  const reference = useGovernmentReference().data;
  return (
    <Section title={t('government.application.copies')}>
      <Card className="gap-3">
        {application.copies.length === 0 ? <p className="text-sm text-muted">{t('government.application.noCopies')}</p> : null}
        {application.copies.map((copy) => (
          <div key={copy.id} className="flex items-center justify-between gap-2">
            <a className="text-primary underline" href={copy.url} target="_blank" rel="noreferrer">
              {copy.fileName}
            </a>
            <Button variant="ghost" onClick={() => actions.removeCopy.mutate(copy.id)}>
              {t('government.application.remove')}
            </Button>
          </div>
        ))}
        <FileDropZone
          label={t('government.application.addCopy')}
          hint={t('government.application.copyHint')}
          accept={reference?.copyTypes ?? []}
          maxBytes={reference?.copyMaxBytes ?? 0}
          busy={actions.addCopy.isPending}
          onFile={(file) => actions.addCopy.mutate({ name: file.name, type: file.type, size: file.size, blob: file }, { onError: failed })}
          onReject={() => failed(undefined)}
        />
      </Card>
    </Section>
  );
}

function CredentialsSection({ application }: { application: GovApplication }) {
  const t = useT();
  const actions = useGovApplicationActions(application.id);
  const [values, setValues] = useState<SecretValues>({});
  const [shown, setShown] = useState<SecretValues | undefined>();
  const kinds = application.secretsPresent.includes(SecretKind.TransactionId) ? [...ENTRY_KINDS, SecretKind.TransactionId] : ENTRY_KINDS;
  return (
    <Section title={t('government.application.credentials')}>
      <Card className="gap-3">
        <p className="text-sm text-muted">{t('government.application.credentialsBody')}</p>
        {kinds.map((kind) => (
          <TextField
            key={kind}
            label={t(enumLabelKey('secret_kind', kind))}
            hint={application.secretsPresent.includes(kind) ? t('government.application.savedSecret') : t('government.application.enterSecret')}
            secret
            value={values[kind] ?? ''}
            onChange={(event) => setValues({ ...values, [kind]: event.target.value })}
          />
        ))}
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => actions.setSecrets.mutate(values, { onSuccess: () => setValues({}) })} loading={actions.setSecrets.isPending}>
            {t('government.application.save')}
          </Button>
          <Button variant="outline" onClick={() => (shown ? setShown(undefined) : actions.reveal.mutate(undefined, { onSuccess: setShown }))}>
            {shown ? t('government.application.hide') : t('government.application.reveal')}
          </Button>
        </div>
        {shown ? (
          <ul className="text-sm">
            {Object.entries(shown).map(([kind, value]) => (
              <li key={kind}>
                {t(enumLabelKey('secret_kind', kind))}: <span className="font-mono">{value}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </Card>
    </Section>
  );
}

export function GovApplicationPage() {
  const { id } = useParams<{ id: string }>();
  const t = useT();
  const router = useRouter();
  const application = useGovApplication(id);
  const actions = useGovApplicationActions(id);
  const withdraw = useWithdrawGovApplication();
  const failed = useFailure();
  if (application.isPending) {
    return <LoadingState />;
  }
  if (application.isError) {
    return <ErrorState onRetry={() => void application.refetch()} />;
  }
  const a = application.data;
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={a.circularTitle}
        description={`${a.authority} · ${t(enumLabelKey('gov_application_status', a.status))}`}
        actions={
          <ConfirmDialog
            title={t('government.application.withdraw')}
            body={t('government.application.withdrawConfirm')}
            confirmLabel={t('government.application.withdraw')}
            destructive
            onConfirm={() => withdraw.mutate(id, { onSuccess: () => router.push(Routes.government) })}
            trigger={<Button variant="outline">{t('government.application.withdraw')}</Button>}
          />
        }
      />
      <Card>
        <p className="text-sm">{a.postTitles.join(', ')}</p>
        <div className="flex flex-wrap gap-2">
          {canMarkSubmitted(a) ? (
            <Button onClick={() => actions.submitted.mutate(undefined, { onError: failed })} loading={actions.submitted.isPending}>
              {t('government.application.markSubmitted')}
            </Button>
          ) : null}
          {a.status === GovApplicationStatus.Submitted ? (
            <Button onClick={() => actions.confirm.mutate(undefined, { onError: failed })} loading={actions.confirm.isPending}>
              {t('government.application.confirm')}
            </Button>
          ) : null}
        </div>
        {a.status === GovApplicationStatus.Submitted ? <p className="text-sm text-muted">{t('government.application.confirmHint')}</p> : null}
      </Card>
      <GuideSection id={id} />
      <FeeSection application={a} />
      <StagesSection application={a} />
      <CopiesSection application={a} />
      <CredentialsSection application={a} />
    </div>
  );
}
