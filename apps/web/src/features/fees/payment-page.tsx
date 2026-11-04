'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import type { PaymentView, ReceiptInput } from '@careerpilot/api-client';
import {
  actionNeedsEvidence,
  actionNeedsNote,
  availableActions,
  enumLabelKey,
  feeActionKey,
  feeErrorKey,
  feeGuidanceKey,
  feeKindKey,
  feeReceiptKey,
  feeStatusKey,
  feeStatusTone,
  feeUrgencyKey,
  feeWarningKey,
  useFeeActions,
  useFeeAmount,
  useFormat,
  usePayment,
  useT,
} from '@careerpilot/client-core';
import { PaymentAction, PaymentStatus, ReceiptKind, StatusTone } from '@careerpilot/domain-ui-logic';
import { Badge, Button, Card, ConfirmDialog, ErrorState, LoadingState, PageHeader, Section, SelectField, TextField, useToast } from '@careerpilot/ui-web';
import { Routes } from '@/core/routes';
import { PaymentFormDialog } from './fee-forms';

function StatusPanel({ view }: { view: PaymentView }) {
  const t = useT();
  const toast = useToast();
  const actions = useFeeActions();
  const choices = availableActions(view.payment.status);
  const [action, setAction] = useState<PaymentAction | undefined>(choices[0]);
  const [note, setNote] = useState('');
  const [transactionId, setTransactionId] = useState('');
  const [reference, setReference] = useState('');
  const [problem, setProblem] = useState<string | undefined>();
  if (!choices.length) {
    return null;
  }
  const selected = action && choices.includes(action) ? action : choices[0]!;
  const uncertain = view.payment.status === PaymentStatus.Uncertain;
  const apply = () => {
    const receipt: ReceiptInput | undefined = reference.trim() ? { kind: ReceiptKind.ConfirmationMessage, reference: reference.trim() } : undefined;
    const supplied = Boolean(transactionId.trim() || receipt);
    if (actionNeedsEvidence(selected, view) && !supplied) {
      setProblem('fees.actions.evidenceNeeded');
      return;
    }
    if (actionNeedsNote(selected) && !note.trim()) {
      setProblem('fees.actions.noteRequired');
      return;
    }
    setProblem(undefined);
    actions.record.mutate(
      { id: view.payment.id, action: { action: selected, note: note.trim(), transactionId: transactionId.trim() || undefined, receipt } },
      {
        onSuccess: () => {
          setNote('');
          setReference('');
          setTransactionId('');
        },
        onError: (error) => toast.show({ message: t(feeErrorKey(error)) }),
      },
    );
  };
  return (
    <Section title={uncertain ? t('fees.actions.uncertainTitle') : t('fees.actions.title')}>
      <Card className="gap-3">
        {uncertain ? <p className="text-sm text-warning">{t('fees.actions.uncertainBody')}</p> : null}
        <SelectField
          label={t('fees.actions.title')}
          value={selected}
          options={choices.map((choice) => ({ value: choice, label: t(feeActionKey(choice)) }))}
          onValueChange={(value) => setAction(value as PaymentAction)}
        />
        {selected === PaymentAction.ConfirmPaid ? (
          <>
            <TextField label={t('fees.actions.evidenceTransaction')} value={transactionId} onChange={(event) => setTransactionId(event.target.value)} />
            <TextField label={t('fees.receiptReference')} value={reference} onChange={(event) => setReference(event.target.value)} />
          </>
        ) : null}
        <TextField label={t('fees.actions.note')} value={note} onChange={(event) => setNote(event.target.value)} error={problem} />
        <Button onClick={apply} loading={actions.record.isPending}>
          {t('fees.actions.apply')}
        </Button>
      </Card>
    </Section>
  );
}

function Receipts({ view }: { view: PaymentView }) {
  const t = useT();
  const format = useFormat();
  const toast = useToast();
  const actions = useFeeActions();
  const [kind, setKind] = useState<ReceiptKind>(ReceiptKind.ConfirmationMessage);
  const [reference, setReference] = useState('');
  const add = () => {
    if (!reference.trim()) {
      return;
    }
    actions.addReceipt.mutate(
      { id: view.payment.id, receipt: { kind, reference: reference.trim() } },
      { onSuccess: () => setReference(''), onError: (error) => toast.show({ message: t(feeErrorKey(error)) }) },
    );
  };
  return (
    <Section title={t('fees.receipts')}>
      <Card className="gap-3">
        {view.payment.receipts.length === 0 ? <p className="text-sm text-muted">{t('fees.noReceipts')}</p> : null}
        {view.payment.receipts.map((receipt) => (
          <div key={receipt.id} className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="break-words font-medium">{receipt.reference}</p>
              <p className="text-sm text-muted">{[t(feeReceiptKey(receipt.kind)), format.dateTime(receipt.addedAt)].join(' · ')}</p>
            </div>
            <Button
              size="sm"
              variant="outline"
              aria-label={t('fees.receiptRemove', { reference: receipt.reference })}
              onClick={() => actions.removeReceipt.mutate({ id: view.payment.id, receiptId: receipt.id })}
            >
              {t('fees.remove')}
            </Button>
          </div>
        ))}
        <SelectField
          label={t('fees.receiptKindLabel')}
          value={kind}
          options={Object.values(ReceiptKind).map((value) => ({ value, label: t(feeReceiptKey(value)) }))}
          onValueChange={(value) => setKind(value as ReceiptKind)}
        />
        <TextField label={t('fees.receiptReference')} value={reference} onChange={(event) => setReference(event.target.value)} />
        <Button variant="outline" onClick={add} loading={actions.addReceipt.isPending}>
          {t('fees.addReceipt')}
        </Button>
      </Card>
    </Section>
  );
}

export function PaymentPage() {
  const { id } = useParams<{ id: string }>();
  const t = useT();
  const router = useRouter();
  const format = useFormat();
  const amount = useFeeAmount();
  const payment = usePayment(id);
  const actions = useFeeActions();
  const [editing, setEditing] = useState(false);
  if (payment.isPending) {
    return <LoadingState />;
  }
  if (payment.isError) {
    return <ErrorState onRetry={() => void payment.refetch()} />;
  }
  const view = payment.data;
  const p = view.payment;
  const urgency = feeUrgencyKey(view.urgency);
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={p.title}
        description={[t(feeKindKey(p.kind)), p.payee].filter(Boolean).join(' · ')}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setEditing(true)}>
              {t('fees.edit')}
            </Button>
            <ConfirmDialog
              title={t('fees.remove')}
              body={t('fees.removeConfirm')}
              confirmLabel={t('fees.remove')}
              destructive
              onConfirm={() => actions.removePayment.mutate(id, { onSuccess: () => router.push(Routes.fees) })}
              trigger={<Button variant="outline">{t('fees.remove')}</Button>}
            />
          </div>
        }
      />
      <Card className="gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge label={t(feeStatusKey(p.status))} tone={feeStatusTone(p.status)} />
          {urgency ? <Badge label={t(urgency)} tone={StatusTone.Warning} /> : null}
        </div>
        <p className="text-lg font-semibold">{amount(p.amount, p.currency)}</p>
        <p className="text-sm text-muted">
          {[
            p.deadline ? t('fees.dueOn', { date: format.date(p.deadline) }) : t('fees.noDeadline'),
            p.paidAt ? t('fees.paidOn', { date: format.date(p.paidAt) }) : undefined,
            p.method ? t(enumLabelKey('payment_method', p.method)) : undefined,
            p.transactionId,
          ]
            .filter(Boolean)
            .join(' · ')}
        </p>
        {view.warnings.map((warning) => (
          <p key={warning} className="text-sm text-warning" role="note">
            {t(feeWarningKey(warning))}
          </p>
        ))}
        {view.guidance.length ? (
          <div>
            <p className="text-sm font-semibold">{t('fees.guidance.title')}</p>
            <ul className="list-disc pl-5 text-sm text-muted">
              {view.guidance.map((step) => (
                <li key={step}>{t(feeGuidanceKey(step))}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </Card>
      <StatusPanel key={p.status} view={view} />
      <Receipts view={view} />
      <Section title={t('fees.history')}>
        <Card className="gap-1">
          {p.history.map((event) => (
            <p key={`${event.at}-${event.status}`} className="text-sm">
              {format.dateTime(event.at)} · {t(feeStatusKey(event.status))}
              {event.note ? ` · ${event.note}` : ''}
            </p>
          ))}
        </Card>
      </Section>
      {editing ? <PaymentFormDialog open initial={p} onOpenChange={setEditing} /> : null}
    </div>
  );
}
