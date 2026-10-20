import { MailCheck } from 'lucide-react-native';
import { StatusTone } from '@careerpilot/domain-ui-logic';
import { useT } from '@/core/i18n/i18n';
import { Banner, Button, Card, Screen, TextField } from '@/ui';
import { usePasswordReset } from './use-auth-forms';

export function ForgotPasswordScreen() {
  const t = useT();
  const form = usePasswordReset();
  return (
    <Screen testID="forgot-password-screen">
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
