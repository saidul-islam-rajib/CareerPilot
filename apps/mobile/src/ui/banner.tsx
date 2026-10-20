import type { ReactNode } from 'react';
import { View } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { StatusTone } from '@careerpilot/domain-ui-logic';
import { useTheme } from '@/core/theme/theme';
import { Icon } from './icon';
import { Text, TextVariant } from './text';

export interface BannerProps {
  tone: StatusTone;
  icon: LucideIcon;
  title: string;
  body?: string;
  action?: ReactNode;
}

export function Banner({ tone, icon, title, body, action }: BannerProps) {
  const theme = useTheme();
  const c = theme.colors;
  const colors: Record<StatusTone, [string, string]> = {
    neutral: [c.neutral, c.neutralSubtle],
    info: [c.info, c.infoSubtle],
    success: [c.success, c.successSubtle],
    warning: [c.warning, c.warningSubtle],
    danger: [c.danger, c.dangerSubtle],
    primary: [c.primary, c.primarySubtle],
  };
  const [fg, bg] = colors[tone];
  return (
    <View
      accessibilityRole="summary"
      style={{ flexDirection: 'row', gap: theme.space.md, padding: theme.space.lg, borderRadius: theme.radius.card, backgroundColor: bg, alignItems: 'flex-start' }}
    >
      <Icon icon={icon} color={fg} />
      <View style={{ flex: 1, gap: theme.space.xs }}>
        <Text variant={TextVariant.Subheading} style={{ color: fg }}>
          {title}
        </Text>
        {body ? <Text variant={TextVariant.Label} style={{ color: fg }}>{body}</Text> : null}
        {action}
      </View>
    </View>
  );
}
