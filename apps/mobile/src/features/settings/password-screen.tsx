import { useChangePasswordForm, usePublicConfig, useT } from '@careerpilot/client-core';
import { AlertCircle, CheckCircle2 } from 'lucide-react-native';
import { StatusTone } from '@careerpilot/domain-ui-logic';
import { Banner, Button, Card, Screen, TextField } from '@/ui';

export function PasswordScreen() {
  const t = useT();
  const form = useChangePasswordForm();
  const { config } = usePublicConfig();
  const passwordParams = { min: config.validationPolicy.password.minLength };
  return (
    <Screen testID="password-screen">
      {form.changed ? <Banner tone={StatusTone.Success} icon={CheckCircle2} title={t('settings.passwordChanged')} /> : null}
      {form.formError ? <Banner tone={StatusTone.Danger} icon={AlertCircle} title={t(form.formError)} /> : null}
      <Card>
        <TextField
          label={t('settings.currentPassword')}
          value={form.values.currentPassword}
          onChangeText={(v) => form.setField('currentPassword', v)}
          error={form.errors.currentPassword}
          secret
          autoComplete="current-password"
          textContentType="password"
          testID="current-password"
        />
        <TextField
          label={t('settings.newPassword')}
          value={form.values.newPassword}
          onChangeText={(v) => form.setField('newPassword', v)}
          error={form.errors.newPassword}
          errorParams={passwordParams}
          hint={t('validation.passwordLength', passwordParams)}
          secret
          autoComplete="new-password"
          textContentType="newPassword"
          testID="new-password"
        />
        <TextField
          label={t('settings.confirmNewPassword')}
          value={form.values.confirmPassword}
          onChangeText={(v) => form.setField('confirmPassword', v)}
          error={form.errors.confirmPassword}
          secret
          autoComplete="new-password"
          textContentType="newPassword"
          onSubmitEditing={form.submit}
          testID="confirm-password"
        />
        <Button label={t('settings.changePassword')} onPress={form.submit} loading={form.submitting} fullWidth testID="password-save" />
      </Card>
    </Screen>
  );
}
