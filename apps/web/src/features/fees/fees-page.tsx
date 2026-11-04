'use client';

import { useState } from 'react';
import Link from 'next/link';
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
import { Badge, Button, Card, ConfirmDialog, EmptyState, ErrorState, LoadingState, PageHeader, Section, useToast } from '@careerpilot/ui-web';
import { Routes } from '@/core/routes';
import { PaymentFormDialog, RuleFormDialog } from './fee-forms';

const REMINDER_TONES: Record<FeeReminderKind, StatusTone> = {
  [FeeReminderKind.DueSoon]: StatusTone.Warning,
  [FeeReminderKind.Overdue]: StatusTone.Danger,
  [FeeReminderKind.ConfirmOutcome]: StatusTone.Warning,
};

function lineHref(line: FeeLine): string | undefined {
  if (line.source === FeeLineSource.Payment) {
    return Routes.feesPayment(line.id);
  }
  return line.source === FeeLineSource.Government ? Routes.governmentApplication(line.id) : undefined;
}

function RuleActions({ line, rule, onEdit }: { line: FeeLine; rule?: RuleView; onEdit: (rule: RuleView) => void }) {
  const t = useT();
  const toast = useToast();
  const actions = useFeeActions();
  const failed = (error: unknown) => toast.show({ message: t(feeErrorKey(error)) });
  return (
    <div className="flex flex-wrap gap-2">
      <Button size="sm" onClick={() => actions.paymentFromRule.mutate(line.id, { onError: failed })} loading={actions.paymentFromRule.isPending}>
        {t('fees.recordPayment')}
      </Button>
      {rule ? (
        <Button size="sm" variant="outline" onClick={() => onEdit(rule)}>
          {t('fees.edit')}
        </Button>
      ) : null}
      <ConfirmDialog
        title={t('fees.remove')}
        body={t('fees.removeConfirm')}
        confirmLabel={t('fees.remove')}
        destructive
        onConfirm={() => actions.removeRule.mutate(line.id, { onError: failed })}
        trigger={
          <Button size="sm" variant="outline">
            {t('fees.remove')}
          </Button>
        }
      />
    </div>
  );
}

function LineCard({ line, rule, onEdit }: { line: FeeLine; rule?: RuleView; onEdit: (rule: RuleView) => void }) {
  const t = useT();
  const format = useFormat();
  const amount = useFeeAmount();
  const href = lineHref(line);
  const urgency = feeUrgencyKey(line.urgency);
  return (
    <Card className="gap-2">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          {href ? (
            <Link href={href} className="text-lg font-semibold text-primary hover:underline">
              {line.title}
            </Link>
          ) : (
            <p className="text-lg font-semibold">{line.title}</p>
          )}
          <p className="text-sm text-muted">{[t(`fees.source.${line.source}`), line.organization, t(feeKindKey(line.kind))].filter(Boolean).join(' · ')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {urgency ? <Badge label={t(urgency)} tone={StatusTone.Warning} /> : null}
          <Badge label={t(feeStatusKey(line.status))} tone={feeStatusTone(line.status)} />
        </div>
      </div>
      <p className="text-sm">
        {amount(line.amount, line.currency)} · {line.deadline ? t('fees.dueOn', { date: format.date(line.deadline) }) : t('fees.noDeadline')}
      </p>
      {line.warnings.map((warning) => (
        <p key={warning} className="text-sm text-warning" role="note">
          {t(feeWarningKey(warning))}
        </p>
      ))}
      {line.guidance.length ? (
        <ul className="list-disc pl-5 text-sm text-muted">
          {line.guidance.map((step) => (
            <li key={step}>{t(feeGuidanceKey(step))}</li>
          ))}
        </ul>
      ) : null}
      {line.source === FeeLineSource.FeeRule ? <RuleActions line={line} rule={rule} onEdit={onEdit} /> : null}
    </Card>
  );
}

function Totals({ totals }: { totals: { currency: string; due: number; uncertain: number; paid: number }[] }) {
  const t = useT();
  const amount = useFeeAmount();
  if (!totals.length) {
    return null;
  }
  return (
    <Section title={t('fees.totals')}>
      <Card className="gap-2">
        {totals.map((total) => (
          <p key={total.currency} className="flex flex-wrap gap-x-4 text-sm">
            <span className="font-semibold">{total.currency}</span>
            <span>{t('fees.totalDue')}: {amount(total.due, total.currency)}</span>
            <span>{t('fees.totalUncertain')}: {amount(total.uncertain, total.currency)}</span>
            <span>{t('fees.totalPaid')}: {amount(total.paid, total.currency)}</span>
          </p>
        ))}
      </Card>
    </Section>
  );
}

export function FeesPage() {
  const t = useT();
  const format = useFormat();
  const overview = useFeesOverview();
  const rules = useFeeRules();
  const [ruleDialog, setRuleDialog] = useState<{ open: boolean; rule?: RuleView }>({ open: false });
  const [paymentOpen, setPaymentOpen] = useState(false);
  return (
    <>
      <PageHeader
        title={t('fees.title')}
        description={t('fees.subtitle')}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setRuleDialog({ open: true })}>{t('fees.addRule')}</Button>
            <Button variant="outline" onClick={() => setPaymentOpen(true)}>
              {t('fees.addPayment')}
            </Button>
          </div>
        }
      />
      <p className="text-sm text-muted">{t('fees.officialNote')}</p>
      {overview.isPending ? <LoadingState /> : null}
      {overview.isError ? <ErrorState onRetry={() => void overview.refetch()} /> : null}
      {overview.data ? (
        <>
          <Section title={t('fees.reminders')}>
            {overview.data.reminders.length ? (
              <Card className="gap-2">
                {overview.data.reminders.map((reminder) => (
                  <div key={`${reminder.source}-${reminder.id}-${reminder.kind}`} className="flex flex-wrap items-center gap-2">
                    <Badge label={t(feeReminderKey(reminder.kind))} tone={REMINDER_TONES[reminder.kind]} />
                    <span className="font-medium">{reminder.title}</span>
                    {reminder.deadline ? <span className="text-sm text-muted">{t('fees.dueOn', { date: format.date(reminder.deadline) })}</span> : null}
                  </div>
                ))}
              </Card>
            ) : (
              <EmptyState title={t('fees.noReminders')} />
            )}
          </Section>
          <Totals totals={overview.data.totals} />
          <Section title={t('fees.lines')}>
            {overview.data.lines.length ? (
              <div className="flex flex-col gap-3">
                {overview.data.lines.map((line) => (
                  <LineCard
                    key={`${line.source}-${line.id}`}
                    line={line}
                    rule={rules.data?.find((rule) => rule.rule.id === line.id)}
                    onEdit={(rule) => setRuleDialog({ open: true, rule })}
                  />
                ))}
              </div>
            ) : (
              <EmptyState title={t('fees.noPayments')} />
            )}
          </Section>
        </>
      ) : null}
      {ruleDialog.open ? (
        <RuleFormDialog open initial={ruleDialog.rule} onOpenChange={(open) => setRuleDialog({ open, rule: open ? ruleDialog.rule : undefined })} />
      ) : null}
      {paymentOpen ? <PaymentFormDialog open onOpenChange={setPaymentOpen} /> : null}
    </>
  );
}
