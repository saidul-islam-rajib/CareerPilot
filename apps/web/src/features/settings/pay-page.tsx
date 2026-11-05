'use client';

import { useT, useCompensation } from '@careerpilot/client-core';
import { CompensationMode, PayPeriod, RangeBasis, UnstatedPolicy } from '@careerpilot/domain-ui-logic';
import { Button, Card, ErrorState, LoadingState, PageHeader, SelectField, TextField } from '@careerpilot/ui-web';

export function PayPage() {
  const t = useT();
  const pay = useCompensation();
  const { settings, form } = pay;
  return (
    <>
      <PageHeader title={t('settings.pay.title')} description={t('settings.pay.body')} />
      {settings.isPending ? <LoadingState /> : null}
      {settings.isError ? <ErrorState onRetry={() => void settings.refetch()} /> : null}
      {settings.isSuccess ? (
        <Card className="max-w-2xl gap-4">
          <div className="grid grid-cols-2 gap-3">
            <TextField
              label={t('settings.pay.minimum')}
              hint={t('settings.pay.minimumHint')}
              inputMode="decimal"
              value={form.amount}
              error={pay.error ? t(pay.error) : undefined}
              onChange={(event) => pay.change('amount', event.target.value)}
            />
            <SelectField
              label={t('settings.pay.currency')}
              value={form.currency}
              options={pay.currencies.map((code) => ({ value: code, label: code }))}
              onValueChange={(value) => pay.change('currency', value)}
            />
          </div>
          <SelectField
            label={t('settings.pay.period')}
            value={form.period}
            options={Object.values(PayPeriod).map((value) => ({ value, label: t(`settings.pay.periods.${value}`) }))}
            onValueChange={(value) => pay.change('period', value as PayPeriod)}
          />
          <SelectField
            label={t('settings.pay.mode')}
            value={form.mode}
            options={Object.values(CompensationMode).map((value) => ({ value, label: t(`settings.pay.modes.${value}`) }))}
            onValueChange={(value) => pay.change('mode', value as CompensationMode)}
          />
          <SelectField
            label={t('settings.pay.unstated')}
            value={form.unstated}
            options={Object.values(UnstatedPolicy).map((value) => ({ value, label: t(`settings.pay.unstatedPolicies.${value}`) }))}
            onValueChange={(value) => pay.change('unstated', value as UnstatedPolicy)}
          />
          <SelectField
            label={t('settings.pay.basis')}
            value={form.basis}
            options={Object.values(RangeBasis).map((value) => ({ value, label: t(`settings.pay.bases.${value}`) }))}
            onValueChange={(value) => pay.change('basis', value as RangeBasis)}
          />
          {pay.failed ? <p role="alert">{t('settings.pay.failed')}</p> : null}
          {pay.saved ? <p role="status">{t('settings.pay.saved')}</p> : null}
          <Button onClick={pay.submit} disabled={pay.saving || !pay.dirty}>
            {t('settings.pay.save')}
          </Button>
        </Card>
      ) : null}
    </>
  );
}
