import { MailCheck } from '@/ui/icons';
import { usePasswordReset, useT } from '@careerpilot/client-core';
import { StatusTone } from '@careerpilot/domain-ui-logic';
import { Banner, Button, Card, Screen, Text, TextField, TextTone } from '@/ui';

export function ForgotPasswordScreen() {
  const t = useT();
  const form = usePasswordReset();
  return (
    <Screen testID="forgot-password-screen">
      <Text tone={TextTone.Muted}>{t('auth.resetIntro')}</Text>
      {form.sent ? <Banner tone={StatusTone.Success} icon={MailCheck} title={t('auth.resetSent', { email: form.email })} /> : null}
      <Card>
        <TextField
          label={t('auth.email')}
          value={form.email}
          onChangeText={form.setEmail}
          error={form.error}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          testID="reset-email"
        />
        <Button label={t('auth.sendResetLink')} onPress={form.submit} loading={form.submitting} fullWidth testID="reset-submit" />
      </Card>
    </Screen>
  );
}
