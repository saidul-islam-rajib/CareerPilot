import { useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
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
import { Routes } from '@/core/navigation/routes';
import { useTheme } from '@/core/theme/theme';
import {
  Badge,
  Button,
  ButtonVariant,
  Card,
  ErrorState,
  LoadingState,
  Screen,
  Section,
  SelectField,
  SnackbarTone,
  Text,
  TextField,
  TextTone,
  TextVariant,
  useSnackbar,
} from '@/ui';
import { PaymentForm } from './fee-forms';

function useFailure() {
  const t = useT();
  const snackbar = useSnackbar();
  return (error: unknown) => snackbar.show({ message: t(feeErrorKey(error)), tone: SnackbarTone.Danger });
}

function StatusPanel({ view }: { view: PaymentView }) {
  const t = useT();
  const actions = useFeeActions();
  const failed = useFailure();
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
    if (actionNeedsEvidence(selected, view) && !transactionId.trim() && !receipt) {
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
        onError: failed,
      },
    );
  };
  return (
    <Section title={uncertain ? t('fees.actions.uncertainTitle') : t('fees.actions.title')}>
      <Card>
        {uncertain ? <Text tone={TextTone.Warning}>{t('fees.actions.uncertainBody')}</Text> : null}
        <SelectField
          label={t('fees.actions.title')}
          value={selected}
          placeholder={t('fees.actions.title')}
          options={choices.map((choice) => ({ value: choice, label: t(feeActionKey(choice)) }))}
          onChange={(value) => setAction(value as PaymentAction)}
        />
        {selected === PaymentAction.ConfirmPaid ? (
          <>
            <TextField label={t('fees.actions.evidenceTransaction')} value={transactionId} onChangeText={setTransactionId} />
            <TextField label={t('fees.receiptReference')} value={reference} onChangeText={setReference} />
          </>
        ) : null}
        <TextField label={t('fees.actions.note')} value={note} error={problem} onChangeText={setNote} />
        <Button label={t('fees.actions.apply')} onPress={apply} loading={actions.record.isPending} fullWidth testID="fees-apply" />
      </Card>
    </Section>
  );
}

function Receipts({ view }: { view: PaymentView }) {
  const t = useT();
  const format = useFormat();
  const actions = useFeeActions();
  const failed = useFailure();
  const [kind, setKind] = useState<ReceiptKind>(ReceiptKind.ConfirmationMessage);
  const [reference, setReference] = useState('');
  const add = () => {
    if (!reference.trim()) {
      return;
    }
    actions.addReceipt.mutate({ id: view.payment.id, receipt: { kind, reference: reference.trim() } }, { onSuccess: () => setReference(''), onError: failed });
  };
  return (
    <Section title={t('fees.receipts')}>
      <Card>
        {view.payment.receipts.length === 0 ? <Text tone={TextTone.Muted}>{t('fees.noReceipts')}</Text> : null}
        {view.payment.receipts.map((receipt) => (
          <View key={receipt.id}>
            <Text>{receipt.reference}</Text>
            <Text tone={TextTone.Muted}>{[t(feeReceiptKey(receipt.kind)), format.dateTime(receipt.addedAt)].join(' · ')}</Text>
            <Button
              label={t('fees.remove')}
              accessibilityLabel={t('fees.receiptRemove', { reference: receipt.reference })}
              variant={ButtonVariant.Outline}
              onPress={() => actions.removeReceipt.mutate({ id: view.payment.id, receiptId: receipt.id })}
            />
          </View>
        ))}
        <SelectField
          label={t('fees.receiptKindLabel')}
          value={kind}
          placeholder={t('fees.receiptKindLabel')}
          options={Object.values(ReceiptKind).map((value) => ({ value, label: t(feeReceiptKey(value)) }))}
          onChange={(value) => setKind(value as ReceiptKind)}
        />
        <TextField label={t('fees.receiptReference')} value={reference} onChangeText={setReference} />
        <Button label={t('fees.addReceipt')} variant={ButtonVariant.Outline} onPress={add} loading={actions.addReceipt.isPending} fullWidth />
      </Card>
    </Section>
  );
}

export function PaymentScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useT();
  const theme = useTheme();
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
    <Screen testID="payment-screen">
      <Text variant={TextVariant.Heading}>{p.title}</Text>
      <Text tone={TextTone.Muted}>{[t(feeKindKey(p.kind)), p.payee].filter(Boolean).join(' · ')}</Text>
      <Card>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.space.sm }}>
          <Badge label={t(feeStatusKey(p.status))} tone={feeStatusTone(p.status)} />
          {urgency ? <Badge label={t(urgency)} tone={StatusTone.Warning} /> : null}
        </View>
        <Text variant={TextVariant.Subheading}>{amount(p.amount, p.currency)}</Text>
        <Text tone={TextTone.Muted}>
          {[
            p.deadline ? t('fees.dueOn', { date: format.date(p.deadline) }) : t('fees.noDeadline'),
            p.paidAt ? t('fees.paidOn', { date: format.date(p.paidAt) }) : undefined,
            p.method ? t(enumLabelKey('payment_method', p.method)) : undefined,
            p.transactionId,
          ]
            .filter(Boolean)
            .join(' · ')}
        </Text>
        {view.warnings.map((warning) => (
          <Text key={warning} tone={TextTone.Warning}>
            {t(feeWarningKey(warning))}
          </Text>
        ))}
        {view.guidance.length ? <Text variant={TextVariant.Label}>{t('fees.guidance.title')}</Text> : null}
        {view.guidance.map((step) => (
          <Text key={step} tone={TextTone.Muted}>
            • {t(feeGuidanceKey(step))}
          </Text>
        ))}
      </Card>
      {editing ? (
        <PaymentForm initial={p} onDone={() => setEditing(false)} />
      ) : (
        <Button label={t('fees.edit')} variant={ButtonVariant.Outline} onPress={() => setEditing(true)} fullWidth />
      )}
      <StatusPanel key={p.status} view={view} />
      <Receipts view={view} />
      <Section title={t('fees.history')}>
        <Card>
          {p.history.map((event) => (
            <Text key={`${event.at}-${event.status}`}>
              {format.dateTime(event.at)} · {t(feeStatusKey(event.status))}
              {event.note ? ` · ${event.note}` : ''}
            </Text>
          ))}
        </Card>
      </Section>
      <Button
        label={t('fees.remove')}
        variant={ButtonVariant.Outline}
        onPress={() => actions.removePayment.mutate(id, { onSuccess: () => router.replace(Routes.fees) })}
        fullWidth
      />
    </Screen>
  );
}
