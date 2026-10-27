import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { AlertCircle, MailCheck, RotateCw } from '@/ui/icons';
import { useLinkResend, useT } from '@careerpilot/client-core';
import { StatusTone, formatCountdown } from '@careerpilot/domain-ui-logic';
import { Routes } from '@/core/navigation/routes';
import { useTheme } from '@/core/theme/theme';
import { Banner, Button, ButtonVariant, Card, Icon, IconSize, Text, TextTone, TextVariant } from '@/ui';

export function CheckEmailCard({ email, onStartOver }: { email: string; onStartOver: () => void }) {
  const t = useT();
  const theme = useTheme();
  const router = useRouter();
  const link = useLinkResend(email);
  return (
    <Card testID="check-email">
      <View style={{ alignItems: 'center', gap: theme.space.sm }}>
        <View style={{ padding: theme.space.md, borderRadius: theme.radius.pill, backgroundColor: theme.colors.primarySubtle }}>
          <Icon icon={MailCheck} size={IconSize.Large} color={theme.colors.primary} />
        </View>
        <Text variant={TextVariant.Heading} align="center">
          {t('accountLinks.checkEmailTitle')}
        </Text>
        <Text align="center">{t('accountLinks.checkEmailBody', { email })}</Text>
        <Text variant={TextVariant.Caption} tone={TextTone.Muted} align="center">
          {t('accountLinks.checkEmailExpiry', { minutes: link.ttlMinutes })}
        </Text>
      </View>
      {link.error ? <Banner tone={StatusTone.Danger} icon={AlertCircle} title={t(link.error)} /> : null}
      {link.resent && !link.error ? (
        <Text tone={TextTone.Success} align="center" accessibilityLiveRegion="polite">
          {t('accountLinks.resent')}
        </Text>
      ) : null}
      <Button
        label={link.resendIn > 0 ? t('accountLinks.resendIn', { time: formatCountdown(link.resendIn) }) : t('accountLinks.resend')}
        icon={RotateCw}
        variant={ButtonVariant.Secondary}
        disabled={link.resendIn > 0}
        loading={link.resending}
        onPress={link.resend}
        fullWidth
        testID="resend-link"
      />
      <Button label={t('accountLinks.differentEmail')} variant={ButtonVariant.Ghost} onPress={onStartOver} testID="different-email" />
      <Button label={t('accountLinks.backToSignIn')} variant={ButtonVariant.Ghost} onPress={() => router.replace(Routes.signIn)} />
    </Card>
  );
}
