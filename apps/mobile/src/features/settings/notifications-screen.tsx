import { useNotificationsForm, useT } from '@careerpilot/client-core';
import { AlertCircle, CheckCircle2 } from 'lucide-react-native';
import { StatusTone } from '@careerpilot/domain-ui-logic';
import { Banner, Button, Card, Checkbox, ErrorState, LoadingState, Screen, Text, TextField, TextTone } from '@/ui';

export function NotificationsScreen() {
  const t = useT();
  const form = useNotificationsForm();
  const { settings } = form;

  if (settings.isPending) {
    return <LoadingState />;
  }
  if (settings.isError) {
    return <ErrorState onRetry={() => void settings.refetch()} />;
  }

  return (
    <Screen testID="notifications-screen">
      {form.saved ? <Banner tone={StatusTone.Success} icon={CheckCircle2} title={t('common.saved')} /> : null}
      {form.formError ? <Banner tone={StatusTone.Danger} icon={AlertCircle} title={t(form.formError)} /> : null}
      <Card>
        <Text tone={TextTone.Muted}>{t('settings.digestBody')}</Text>
        <Checkbox checked={form.values.digestEnabled} onChange={form.setDigestEnabled} accessibilityLabel={t('settings.digestEnabled')}>
          {t('settings.digestEnabled')}
        </Checkbox>
        <TextField
          label={t('settings.digestTime')}
          value={form.values.digestTime}
          onChangeText={form.setDigestTime}
          error={form.errors.digestTime}
          placeholder={t('settings.timePlaceholder')}
          keyboardType="numbers-and-punctuation"
          editable={form.values.digestEnabled}
          testID="digest-time"
        />
        <Button label={t('common.save')} onPress={form.submit} loading={form.saving} fullWidth testID="notifications-save" />
      </Card>
    </Screen>
  );
}
