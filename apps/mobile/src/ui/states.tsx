import { ActivityIndicator, View } from 'react-native';
import { AlertCircle, Inbox } from 'lucide-react-native';
import { useT } from '@/core/i18n/i18n';
import { useTheme } from '@/core/theme/theme';
import { Button, ButtonVariant } from './button';
import { Icon, IconSize } from './icon';
import { Text, TextTone, TextVariant } from './text';

export function LoadingState({ label }: { label?: string }) {
  const theme = useTheme();
  const t = useT();
  return (
    <View accessibilityRole="progressbar" accessibilityLabel={label ?? t('common.loading')} style={{ padding: theme.space.xxl, alignItems: 'center', gap: theme.space.md }}>
      <ActivityIndicator color={theme.colors.primary} size="large" />
      <Text tone={TextTone.Muted}>{label ?? t('common.loading')}</Text>
    </View>
  );
}

export function ErrorState({ onRetry, title, body }: { onRetry?: () => void; title?: string; body?: string }) {
  const theme = useTheme();
  const t = useT();
  return (
    <View accessibilityRole="alert" style={{ padding: theme.space.xl, alignItems: 'center', gap: theme.space.md }}>
      <Icon icon={AlertCircle} size={IconSize.Large} color={theme.colors.danger} />
      <Text variant={TextVariant.Heading} align="center">
        {title ?? t('common.errorTitle')}
      </Text>
      <Text tone={TextTone.Muted} align="center">
        {body ?? t('common.errorBody')}
      </Text>
      {onRetry ? <Button label={t('common.retry')} variant={ButtonVariant.Outline} onPress={onRetry} /> : null}
    </View>
  );
}

export function EmptyState({ title, body }: { title?: string; body?: string }) {
  const theme = useTheme();
  const t = useT();
  return (
    <View style={{ padding: theme.space.xl, alignItems: 'center', gap: theme.space.sm }}>
      <Icon icon={Inbox} size={IconSize.Large} color={theme.colors.textMuted} />
      <Text variant={TextVariant.Subheading} align="center">
        {title ?? t('common.emptyTitle')}
      </Text>
      {body ? (
        <Text tone={TextTone.Muted} align="center">
          {body}
        </Text>
      ) : null}
    </View>
  );
}
