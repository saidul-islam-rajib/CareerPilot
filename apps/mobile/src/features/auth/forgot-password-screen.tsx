import { useRouter } from 'expo-router';
import { ArrowLeft, MailCheck } from '@/ui/icons';
import { usePasswordReset, useT } from '@careerpilot/client-core';
import { StatusTone } from '@careerpilot/domain-ui-logic';
import { Routes } from '@/core/navigation/routes';
import { Banner, Button, ButtonVariant, Card, Screen, Text, TextField, TextTone } from '@/ui';

export function ForgotPasswordScreen() {
  const t = useT();
  const router = useRouter();
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
        <Button
          label={t('auth.sendResetLink')}
          variant={form.sent ? ButtonVariant.Secondary : ButtonVariant.Primary}
          onPress={form.submit}
          loading={form.submitting}
          fullWidth
          testID="reset-submit"
        />
      </Card>
      <Button
        label={t('accountLinks.backToSignIn')}
        icon={ArrowLeft}
        variant={form.sent ? ButtonVariant.Primary : ButtonVariant.Ghost}
        onPress={() => router.replace(Routes.signIn)}
        fullWidth
        testID="reset-back-to-sign-in"
      />
    </Screen>
  );
}
