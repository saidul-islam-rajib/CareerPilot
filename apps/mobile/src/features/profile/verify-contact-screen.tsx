import { useLocalSearchParams, useRouter } from 'expo-router';
import { useContactVerification, useProfile, useT } from '@careerpilot/client-core';
import { Button, ButtonVariant, Card, ErrorState, LoadingState, Screen, Text, TextField, TextTone } from '@/ui';
import { useProfileFeedback } from './profile-support';

export function VerifyContactScreen() {
  const t = useT();
  const router = useRouter();
  const feedback = useProfileFeedback();
  const { id } = useLocalSearchParams<{ id: string }>();
  const profile = useProfile();
  const verification = useContactVerification(id, {
    onVerified: () => {
      feedback.saved(t('verification.verified'));
      router.back();
    },
  });

  if (profile.isPending) {
    return <LoadingState />;
  }
  const contact = profile.data?.contacts.find((c) => c.id === id);
  if (profile.isError || !contact) {
    return <ErrorState onRetry={() => void profile.refetch()} />;
  }

  const sent = verification.challenge !== undefined;
  return (
    <Screen testID="verify-contact-screen">
      <Card>
        {sent ? (
          <>
            <Text>
              {t('verification.sentTo', { length: verification.codeLength, destination: verification.challenge?.destination ?? '' })}{' '}
              {t('verification.expires', { minutes: verification.expiresInMinutes })}
            </Text>
            <TextField
              label={t('verification.code')}
              value={verification.code}
              onChangeText={verification.setCode}
              error={verification.error}
              errorParams={{ length: verification.codeLength }}
              keyboardType="number-pad"
              textContentType="oneTimeCode"
              autoComplete="one-time-code"
              maxLength={verification.codeLength}
              autoFocus
              onSubmitEditing={verification.submit}
              testID="verification-code"
            />
            <Button label={t('verification.submit')} onPress={verification.submit} loading={verification.confirming} fullWidth testID="verification-submit" />
            <Button
              label={verification.resendIn > 0 ? t('verification.resendIn', { seconds: verification.resendIn }) : t('verification.resend')}
              variant={ButtonVariant.Ghost}
              disabled={verification.resendIn > 0}
              loading={verification.sending}
              onPress={verification.send}
              testID="verification-resend"
            />
          </>
        ) : (
          <>
            <Text>{t('verification.willSend', { length: verification.codeLength, destination: contact.value })}</Text>
            {verification.error ? <Text tone={TextTone.Danger}>{t(verification.error)}</Text> : null}
            <Button label={t('verification.sendCode')} onPress={verification.send} loading={verification.sending} fullWidth testID="verification-send" />
          </>
        )}
      </Card>
    </Screen>
  );
}
