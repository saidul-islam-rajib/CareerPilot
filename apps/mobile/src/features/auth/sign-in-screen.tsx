import { useRouter } from 'expo-router';
import { useSignInForm, useT } from '@careerpilot/client-core';
import { AlertCircle } from '@/ui/icons';
import { StatusTone } from '@careerpilot/domain-ui-logic';
import { Routes } from '@/core/navigation/routes';
import { Banner, Button, ButtonVariant, Card, Screen, TextField } from '@/ui';
import { ServerLink } from '@/features/settings/server-screen';

export function SignInScreen() {
  const t = useT();
  const router = useRouter();
  const form = useSignInForm();
  return (
    <Screen testID="sign-in-screen">
      {form.formError ? <Banner tone={StatusTone.Danger} icon={AlertCircle} title={t(form.formError)} /> : null}
      <Card>
        <TextField
          label={t('auth.email')}
          value={form.values.email}
          onChangeText={(v) => form.setField('email', v)}
          error={form.errors.email}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          textContentType="emailAddress"
          testID="sign-in-email"
        />
        <TextField
          label={t('auth.password')}
          value={form.values.password}
          onChangeText={(v) => form.setField('password', v)}
          error={form.errors.password}
          secret
          autoComplete="current-password"
          textContentType="password"
          onSubmitEditing={form.submit}
          testID="sign-in-password"
        />
        <Button label={t('auth.signIn')} onPress={form.submit} loading={form.submitting} fullWidth testID="sign-in-submit" />
        <Button label={t('auth.forgotPassword')} variant={ButtonVariant.Ghost} onPress={() => router.push(Routes.forgotPassword)} />
      </Card>
      <Button label={`${t('auth.noAccount')} ${t('auth.createAccount')}`} variant={ButtonVariant.Ghost} onPress={() => router.replace(Routes.register)} />
      <ServerLink />
    </Screen>
  );
}
