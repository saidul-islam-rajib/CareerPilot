import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { View } from 'react-native';
import { AlertCircle, KeyRound, ShieldAlert } from 'lucide-react-native';
import { AccountLinkPurpose, type AccountLinkDetails } from '@careerpilot/api-client';
import { accountLinkErrorKey, useAccountLink, useSetPasswordForm, useT } from '@careerpilot/client-core';
import { StatusTone } from '@careerpilot/domain-ui-logic';
import { Routes } from '@/core/navigation/routes';
import { useTheme } from '@/core/theme/theme';
import { Banner, Button, ButtonVariant, Card, Icon, IconSize, LoadingState, Screen, Text, TextField, TextTone, TextVariant } from '@/ui';

const COPY: Readonly<Record<AccountLinkPurpose, { title: string; body: string; submit: string }>> = {
  [AccountLinkPurpose.Setup]: { title: 'accountLinks.setupTitle', body: 'accountLinks.setupBody', submit: 'accountLinks.setupSubmit' },
  [AccountLinkPurpose.Reset]: { title: 'accountLinks.resetTitle', body: 'accountLinks.resetBody', submit: 'accountLinks.resetSubmit' },
};

function LinkProblem({ messageKey }: { messageKey: string }) {
  const t = useT();
  const theme = useTheme();
  const router = useRouter();
  return (
    <Screen testID="set-password-screen">
      <Card>
        <View style={{ alignItems: 'center', gap: theme.space.sm }}>
          <View style={{ padding: theme.space.md, borderRadius: theme.radius.pill, backgroundColor: theme.colors.warningSubtle }}>
            <Icon icon={ShieldAlert} size={IconSize.Large} color={theme.colors.warning} />
          </View>
          <Text variant={TextVariant.Heading} align="center">
            {t('accountLinks.invalidTitle')}
          </Text>
          <Text tone={TextTone.Muted} align="center">
            {t(messageKey)}
          </Text>
        </View>
        <Button label={t('accountLinks.requestNew')} onPress={() => router.replace(Routes.forgotPassword)} fullWidth testID="request-new-link" />
        <Button label={t('accountLinks.backToSignIn')} variant={ButtonVariant.Ghost} onPress={() => router.replace(Routes.signIn)} />
      </Card>
    </Screen>
  );
}

function PasswordForm({ token, details }: { token: string; details: AccountLinkDetails }) {
  const t = useT();
  const form = useSetPasswordForm(token);
  const copy = COPY[details.purpose];
  const passwordParams = { min: form.policy.password.minLength };
  return (
    <Screen
      testID="set-password-screen"
      footer={<Button label={t(copy.submit)} icon={KeyRound} onPress={form.submit} loading={form.submitting || form.done} fullWidth testID="set-password-submit" />}
    >
      <Stack.Screen options={{ title: t(copy.title) }} />
      <Text tone={TextTone.Muted}>{t(copy.body, { name: details.fullName })}</Text>
      <Text variant={TextVariant.Label}>{details.email}</Text>
      {form.formError ? <Banner tone={StatusTone.Danger} icon={AlertCircle} title={t(form.formError)} /> : null}
      <Card>
        <TextField
          label={t('auth.password')}
          value={form.values.password}
          onChangeText={(v) => form.setField('password', v)}
          error={form.errors.password}
          errorParams={passwordParams}
          hint={t('validation.passwordLength', passwordParams)}
          secret
          autoComplete="new-password"
          textContentType="newPassword"
          testID="new-password"
        />
        <TextField
          label={t('auth.confirmPassword')}
          value={form.values.confirmPassword}
          onChangeText={(v) => form.setField('confirmPassword', v)}
          error={form.errors.confirmPassword}
          secret
          autoComplete="new-password"
          textContentType="newPassword"
          testID="confirm-password"
        />
      </Card>
    </Screen>
  );
}

export function SetPasswordScreen() {
  const t = useT();
  const params = useLocalSearchParams<{ token?: string }>();
  const token = params.token?.trim() ?? '';
  const link = useAccountLink(token);
  if (!token) {
    return <LinkProblem messageKey="accountLinks.linkMissing" />;
  }
  if (link.isPending) {
    return <LoadingState label={t('accountLinks.checking')} />;
  }
  if (link.isError) {
    return <LinkProblem messageKey={accountLinkErrorKey(link.error)} />;
  }
  return <PasswordForm token={token} details={link.data} />;
}
