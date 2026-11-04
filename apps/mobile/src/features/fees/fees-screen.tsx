import { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import type { FeeLine, RuleView } from '@careerpilot/api-client';
import {
  feeErrorKey,
  feeGuidanceKey,
  feeKindKey,
  feeReminderKey,
  feeStatusKey,
  feeStatusTone,
  feeUrgencyKey,
  feeWarningKey,
  useFeeActions,
  useFeeAmount,
  useFeeRules,
  useFeesOverview,
  useFormat,
  useT,
} from '@careerpilot/client-core';
import { FeeLineSource, FeeReminderKind, StatusTone } from '@careerpilot/domain-ui-logic';
import { Routes } from '@/core/navigation/routes';
import { useTheme } from '@/core/theme/theme';
import { Badge, Button, ButtonVariant, Card, EmptyState, ErrorState, LoadingState, Screen, Section, SnackbarTone, Text, TextTone, TextVariant, useSnackbar } from '@/ui';
import { PaymentForm, RuleForm } from './fee-forms';

const REMINDER_TONES: Record<FeeReminderKind, StatusTone> = {
  [FeeReminderKind.DueSoon]: StatusTone.Warning,
  [FeeReminderKind.Overdue]: StatusTone.Danger,
  [FeeReminderKind.ConfirmOutcome]: StatusTone.Warning,
};

function LineCard({ line, rule, onEdit }: { line: FeeLine; rule?: RuleView; onEdit: (rule: RuleView) => void }) {
  const t = useT();
  const theme = useTheme();
  const router = useRouter();
  const format = useFormat();
  const amount = useFeeAmount();
  const actions = useFeeActions();
  const snackbar = useSnackbar();
  const urgency = feeUrgencyKey(line.urgency);
  const failed = (error: unknown) => snackbar.show({ message: t(feeErrorKey(error)), tone: SnackbarTone.Danger });
  return (
    <Card>
      <Text variant={TextVariant.Subheading}>{line.title}</Text>
      <Text tone={TextTone.Muted}>{[t(`fees.source.${line.source}`), line.organization, t(feeKindKey(line.kind))].filter(Boolean).join(' · ')}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.space.sm }}>
        <Badge label={t(feeStatusKey(line.status))} tone={feeStatusTone(line.status)} />
        {urgency ? <Badge label={t(urgency)} tone={StatusTone.Warning} /> : null}
      </View>
      <Text>
        {amount(line.amount, line.currency)} · {line.deadline ? t('fees.dueOn', { date: format.date(line.deadline) }) : t('fees.noDeadline')}
      </Text>
      {line.warnings.map((warning) => (
        <Text key={warning} tone={TextTone.Warning}>
          {t(feeWarningKey(warning))}
        </Text>
      ))}
      {line.guidance.map((step) => (
        <Text key={step} tone={TextTone.Muted}>
          • {t(feeGuidanceKey(step))}
        </Text>
      ))}
      {line.source === FeeLineSource.Payment ? (
        <Button label={t('fees.openPayment')} variant={ButtonVariant.Secondary} onPress={() => router.push(Routes.feesPayment(line.id))} fullWidth />
      ) : null}
      {line.source === FeeLineSource.Government ? (
        <Button label={t('fees.openApplication')} variant={ButtonVariant.Secondary} onPress={() => router.push(Routes.governmentApplication(line.id))} fullWidth />
      ) : null}
      {line.source === FeeLineSource.FeeRule ? (
        <>
          <Button
            label={t('fees.recordPayment')}
            onPress={() => actions.paymentFromRule.mutate(line.id, { onError: failed })}
            loading={actions.paymentFromRule.isPending}
            fullWidth
          />
          {rule ? <Button label={t('fees.edit')} variant={ButtonVariant.Outline} onPress={() => onEdit(rule)} fullWidth /> : null}
          <Button label={t('fees.remove')} variant={ButtonVariant.Outline} onPress={() => actions.removeRule.mutate(line.id, { onError: failed })} fullWidth />
        </>
      ) : null}
    </Card>
  );
}

export function FeesScreen() {
  const t = useT();
  const format = useFormat();
  const amount = useFeeAmount();
  const overview = useFeesOverview();
  const rules = useFeeRules();
  const [form, setForm] = useState<{ kind: 'rule' | 'payment'; rule?: RuleView } | undefined>();
  if (overview.isPending) {
    return <LoadingState />;
  }
  if (overview.isError) {
    return <ErrorState onRetry={() => void overview.refetch()} />;
  }
  const { lines, reminders, totals } = overview.data;
  return (
    <Screen testID="fees-screen">
      <Text tone={TextTone.Muted}>{t('fees.subtitle')}</Text>
      <Text tone={TextTone.Muted}>{t('fees.officialNote')}</Text>
      {form?.kind === 'rule' ? <RuleForm key={form.rule?.rule.id ?? 'new'} initial={form.rule} onDone={() => setForm(undefined)} /> : null}
      {form?.kind === 'payment' ? <PaymentForm onDone={() => setForm(undefined)} /> : null}
      {form ? null : (
        <>
          <Button label={t('fees.addRule')} onPress={() => setForm({ kind: 'rule' })} fullWidth testID="fees-add-rule" />
          <Button label={t('fees.addPayment')} variant={ButtonVariant.Outline} onPress={() => setForm({ kind: 'payment' })} fullWidth />
        </>
      )}
      <Section title={t('fees.reminders')}>
        {reminders.length ? (
          <Card>
            {reminders.map((reminder) => (
              <View key={`${reminder.source}-${reminder.id}-${reminder.kind}`}>
                <Badge label={t(feeReminderKey(reminder.kind))} tone={REMINDER_TONES[reminder.kind]} />
                <Text>{reminder.title}</Text>
                {reminder.deadline ? <Text tone={TextTone.Muted}>{t('fees.dueOn', { date: format.date(reminder.deadline) })}</Text> : null}
              </View>
            ))}
          </Card>
        ) : (
          <EmptyState title={t('fees.noReminders')} />
        )}
      </Section>
      {totals.length ? (
        <Section title={t('fees.totals')}>
          <Card>
            {totals.map((total) => (
              <View key={total.currency}>
                <Text variant={TextVariant.Subheading}>{total.currency}</Text>
                <Text>{t('fees.totalDue')}: {amount(total.due, total.currency)}</Text>
                <Text>{t('fees.totalUncertain')}: {amount(total.uncertain, total.currency)}</Text>
                <Text>{t('fees.totalPaid')}: {amount(total.paid, total.currency)}</Text>
              </View>
            ))}
          </Card>
        </Section>
      ) : null}
      <Section title={t('fees.lines')}>
        {lines.length ? (
          lines.map((line) => (
            <LineCard
              key={`${line.source}-${line.id}`}
              line={line}
              rule={rules.data?.find((rule) => rule.rule.id === line.id)}
              onEdit={(rule) => setForm({ kind: 'rule', rule })}
            />
          ))
        ) : (
          <EmptyState title={t('fees.noPayments')} />
        )}
      </Section>
    </Screen>
  );
}
