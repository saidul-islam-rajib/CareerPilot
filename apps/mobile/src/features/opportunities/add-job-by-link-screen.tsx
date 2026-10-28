import { useRouter } from 'expo-router';
import { useAddJobByLink, useT } from '@careerpilot/client-core';
import { StatusTone } from '@careerpilot/domain-ui-logic';
import { AlertTriangle } from '@/ui/icons';
import { Routes } from '@/core/navigation/routes';
import { Banner, Button, Card, Screen, Text, TextField, TextTone, useSnackbar } from '@/ui';

export function AddJobByLinkScreen() {
  const t = useT();
  const router = useRouter();
  const snackbar = useSnackbar();
  const form = useAddJobByLink((opportunity) => {
    snackbar.show({ message: t('jobLink.added', { title: opportunity.title }) });
    router.replace(Routes.opportunity(opportunity.id));
  });
  return (
    <Screen
      testID="add-job-by-link-screen"
      footer={<Button label={form.adding ? t('jobLink.reading') : t('jobLink.submit')} onPress={form.submit} loading={form.adding} fullWidth testID="job-link-submit" />}
    >
      <Text tone={TextTone.Muted}>{t('jobLink.body')}</Text>
      {form.formError ? <Banner tone={StatusTone.Danger} icon={AlertTriangle} title={t(form.formError)} /> : null}
      <Card>
        <TextField
          label={t('jobLink.url')}
          value={form.url}
          onChangeText={form.setUrl}
          error={form.error}
          hint={t('jobLink.urlHint')}
          keyboardType="url"
          autoCapitalize="none"
          autoCorrect={false}
          testID="job-link-url"
        />
      </Card>
    </Screen>
  );
}
