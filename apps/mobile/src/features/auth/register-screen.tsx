import { useRouter } from 'expo-router';
import { usePublicConfig, useRegisterForm, useT } from '@careerpilot/client-core';
import * as WebBrowser from 'expo-web-browser';
import { AlertCircle } from '@/ui/icons';
import { StatusTone } from '@careerpilot/domain-ui-logic';
import { Routes } from '@/core/navigation/routes';
import { Banner, Button, ButtonVariant, Card, Checkbox, LinkedText, Screen, Text, TextField, TextTone, TextVariant } from '@/ui';
import { CheckEmailCard } from './check-email-card';

export function RegisterScreen() {
  const t = useT();
  const router = useRouter();
  const { config } = usePublicConfig();
  const form = useRegisterForm();
  const nameParams = { min: form.policy.name.minLength, max: form.policy.name.maxLength };
  const open = (url: string) => void WebBrowser.openBrowserAsync(url);
  if (form.sentTo) {
    return (
      <Screen testID="register-screen">
        <CheckEmailCard email={form.sentTo} onStartOver={form.startOver} />
      </Screen>
    );
  }
  return (
    <Screen testID="register-screen">
      <Text tone={TextTone.Muted}>{t('auth.registerIntro')}</Text>
      {form.formError ? <Banner tone={StatusTone.Danger} icon={AlertCircle} title={t(form.formError)} /> : null}
      <Card>
        <TextField
          label={t('auth.fullName')}
          value={form.values.fullName}
          onChangeText={(v) => form.setField('fullName', v)}
          error={form.errors.fullName}
          errorParams={nameParams}
          autoComplete="name"
          textContentType="name"
          testID="register-name"
        />
        <TextField
          label={t('auth.email')}
          value={form.values.email}
          onChangeText={(v) => form.setField('email', v)}
          error={form.errors.email}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          textContentType="emailAddress"
          testID="register-email"
        />
        <Checkbox
          checked={form.values.consent}
          onChange={(v) => form.setField('consent', v)}
          accessibilityLabel={t('auth.consentLabel', { terms: t('auth.terms'), privacy: t('auth.privacy') })}
          error={form.errors.consent}
        >
          <LinkedText
            template={t('auth.consentLabel')}
            links={{
              terms: { label: t('auth.terms'), onPress: () => open(config.legal.termsUrl) },
              privacy: { label: t('auth.privacy'), onPress: () => open(config.legal.privacyUrl) },
            }}
          />
        </Checkbox>
        <Text variant={TextVariant.Caption} tone={TextTone.Muted}>
          {t('auth.consentNote')}
        </Text>
        <Button label={t('auth.createAccount')} onPress={form.submit} loading={form.submitting} fullWidth testID="register-submit" />
      </Card>
      <Button label={`${t('auth.haveAccount')} ${t('auth.signIn')}`} variant={ButtonVariant.Ghost} onPress={() => router.replace(Routes.signIn)} />
    </Screen>
  );
}
