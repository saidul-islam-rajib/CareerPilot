import { useCompensation, useT } from '@careerpilot/client-core';
import { CompensationMode, PayPeriod, RangeBasis, UnstatedPolicy } from '@careerpilot/domain-ui-logic';
import { Button, Card, ErrorState, LoadingState, Screen, SelectField, Text, TextField, TextTone } from '@/ui';

export function PayScreen() {
  const t = useT();
  const pay = useCompensation();
  const { settings, form } = pay;
  if (settings.isPending) {
    return <LoadingState />;
  }
  if (settings.isError) {
    return <ErrorState onRetry={() => void settings.refetch()} />;
  }
  return (
    <Screen testID="pay-screen">
      <Text tone={TextTone.Muted}>{t('settings.pay.body')}</Text>
      <Card>
        <TextField
          label={t('settings.pay.minimum')}
          hint={t('settings.pay.minimumHint')}
          keyboardType="decimal-pad"
          value={form.amount}
          error={pay.error ? t(pay.error) : undefined}
          onChangeText={(value) => pay.change('amount', value)}
        />
        <SelectField
          label={t('settings.pay.currency')}
          value={form.currency}
          placeholder={t('settings.pay.currency')}
          options={pay.currencies.map((code) => ({ value: code, label: code }))}
          onChange={(value) => pay.change('currency', value)}
        />
        <SelectField
          label={t('settings.pay.period')}
          value={form.period}
          placeholder={t('settings.pay.period')}
          options={Object.values(PayPeriod).map((value) => ({ value, label: t(`settings.pay.periods.${value}`) }))}
          onChange={(value) => pay.change('period', value as PayPeriod)}
        />
        <SelectField
          label={t('settings.pay.mode')}
          value={form.mode}
          placeholder={t('settings.pay.mode')}
          options={Object.values(CompensationMode).map((value) => ({ value, label: t(`settings.pay.modes.${value}`) }))}
          onChange={(value) => pay.change('mode', value as CompensationMode)}
        />
        <SelectField
          label={t('settings.pay.unstated')}
          value={form.unstated}
          placeholder={t('settings.pay.unstated')}
          options={Object.values(UnstatedPolicy).map((value) => ({ value, label: t(`settings.pay.unstatedPolicies.${value}`) }))}
          onChange={(value) => pay.change('unstated', value as UnstatedPolicy)}
        />
        <SelectField
          label={t('settings.pay.basis')}
          value={form.basis}
          placeholder={t('settings.pay.basis')}
          options={Object.values(RangeBasis).map((value) => ({ value, label: t(`settings.pay.bases.${value}`) }))}
          onChange={(value) => pay.change('basis', value as RangeBasis)}
        />
        {pay.failed ? <Text tone={TextTone.Danger}>{t('settings.pay.failed')}</Text> : null}
        {pay.saved ? <Text tone={TextTone.Muted}>{t('settings.pay.saved')}</Text> : null}
        <Button label={t('settings.pay.save')} onPress={pay.submit} loading={pay.saving} disabled={!pay.dirty} fullWidth testID="pay-save" />
      </Card>
    </Screen>
  );
}
