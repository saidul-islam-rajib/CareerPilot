import { View } from 'react-native';
import { StatusTone, type EnumKey } from '@careerpilot/domain-ui-logic';
import { useEnumDisplay } from '@/core/config/public-config';
import { useTheme, type AppTheme } from '@/core/theme/theme';
import { Text, TextVariant } from './text';

function toneColors(theme: AppTheme, tone: StatusTone): { fg: string; bg: string } {
  const c = theme.colors;
  const map: Record<StatusTone, { fg: string; bg: string }> = {
    neutral: { fg: c.neutral, bg: c.neutralSubtle },
    info: { fg: c.info, bg: c.infoSubtle },
    success: { fg: c.success, bg: c.successSubtle },
    warning: { fg: c.warning, bg: c.warningSubtle },
    danger: { fg: c.danger, bg: c.dangerSubtle },
    primary: { fg: c.primary, bg: c.primarySubtle },
  };
  return map[tone];
}

export interface BadgeProps {
  label: string;
  tone?: StatusTone;
}

export function Badge({ label, tone = StatusTone.Neutral }: BadgeProps) {
  const theme = useTheme();
  const colors = toneColors(theme, tone);
  return (
    <View
      accessible
      accessibilityLabel={label}
      style={{
        alignSelf: 'flex-start',
        backgroundColor: colors.bg,
        borderRadius: theme.radius.pill,
        paddingHorizontal: theme.space.sm,
        paddingVertical: theme.space.xxs,
      }}
    >
      <Text variant={TextVariant.Caption} style={{ color: colors.fg, fontWeight: theme.fontWeight.semibold }}>
        {label}
      </Text>
    </View>
  );
}

export function EnumBadge({ enumKey, value }: { enumKey: EnumKey; value: string }) {
  const display = useEnumDisplay()(enumKey, value);
  return <Badge label={display.label} tone={display.tone} />;
}
