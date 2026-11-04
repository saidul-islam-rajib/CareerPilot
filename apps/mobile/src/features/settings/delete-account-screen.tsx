import { useState } from 'react';
import { useRouter } from 'expo-router';
import { useCancelDeletion, useDeletion, useFormat, useRequestDeletion, useT } from '@careerpilot/client-core';
import { AlertTriangle, CalendarX } from '@/ui/icons';
import { StatusTone } from '@careerpilot/domain-ui-logic';
import { Routes } from '@/core/navigation/routes';
import { Banner, Button, ButtonVariant, Card, ErrorState, LoadingState, Screen, Text, TextField, TextTone, TextVariant } from '@/ui';

export function DeleteAccountScreen() {
  const t = useT();
  const format = useFormat();
  const router = useRouter();
  const deletion = useDeletion();
  const request = useRequestDeletion();
  const cancel = useCancelDeletion();
  const [typed, setTyped] = useState('');
  const [password, setPassword] = useState('');
  const keyword = t('settings.deleteKeyword');
  const view = deletion.data;
  if (deletion.isLoading) {
    return <LoadingState />;
  }
  if (!view) {
    return <ErrorState onRetry={() => void deletion.refetch()} />;
  }
  if (view.scheduledFor) {
    return (
      <Screen testID="delete-account-screen">
        <Banner tone={StatusTone.Warning} icon={CalendarX} title={t('privacy.deletion.pendingTitle', { date: format.date(view.scheduledFor) })} body={t('privacy.deletion.pendingBody')} />
        <Button label={t('privacy.deletion.cancel')} variant={ButtonVariant.Secondary} onPress={() => cancel.mutate()} loading={cancel.isPending} fullWidth testID="delete-cancel" />
      </Screen>
    );
  }
  return (
    <Screen testID="delete-account-screen">
      <Banner tone={StatusTone.Danger} icon={AlertTriangle} title={t('settings.deleteAccount')} body={t('settings.deleteAccountBody', { days: view.plan.graceDays })} />
      <Card>
        <Text variant={TextVariant.Heading}>{t('privacy.deletion.erasedTitle')}</Text>
        {view.plan.erased.map((scope) => (
          <Text key={scope}>{t(`privacy.deletion.scope.${scope}`)}</Text>
        ))}
        <Text variant={TextVariant.Heading}>{t('privacy.deletion.keptTitle')}</Text>
        {view.plan.retained.map((item) => (
          <Text key={item.record}>{t('privacy.deletion.keptLine', { record: item.record, days: item.retentionDays, reason: item.reason })}</Text>
        ))}
        <Text variant={TextVariant.Heading}>{t('privacy.deletion.externalTitle')}</Text>
        {view.plan.external.map((item) => (
          <Text key={item} tone={TextTone.Muted}>
            {t(`privacy.deletion.external.${item}`)}
          </Text>
        ))}
        <Button label={t('privacy.deletion.exportFirst')} variant={ButtonVariant.Ghost} onPress={() => router.push(Routes.exports)} />
      </Card>
      <Card>
        <TextField label={t('privacy.deletion.passwordLabel')} value={password} onChangeText={setPassword} secureTextEntry testID="delete-password-input" />
        <TextField label={t('settings.deleteAccountConfirm')} value={typed} onChangeText={setTyped} autoCapitalize="characters" testID="delete-confirm-input" />
        {request.isError ? <Text tone={TextTone.Danger}>{t('privacy.deletion.wrongPassword')}</Text> : null}
        <Button
          label={t('settings.deleteAccount')}
          variant={ButtonVariant.Destructive}
          disabled={typed.trim() !== keyword || password.length === 0}
          onPress={() => request.mutate(password)}
          loading={request.isPending}
          fullWidth
          testID="delete-confirm"
        />
      </Card>
    </Screen>
  );
}
