import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { ChevronRight, type LucideIcon } from '@/ui/icons';
import { useTheme } from '@/core/theme/theme';
import { Icon, IconSize } from './icon';
import { Text, TextTone, TextVariant } from './text';

export function Section({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  const theme = useTheme();
  return (
    <View style={{ gap: theme.space.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: theme.space.sm }}>
        <Text variant={TextVariant.Heading} style={{ flexShrink: 1 }}>
          {title}
        </Text>
        {action}
      </View>
      {children}
    </View>
  );
}

export interface RowProps {
  children: ReactNode;
  gap?: number;
  wrap?: boolean;
  align?: 'center' | 'flex-start';
  justify?: 'flex-start' | 'center' | 'space-between';
}

export function Row({ children, gap, wrap = false, align = 'center', justify = 'flex-start' }: RowProps) {
  const theme = useTheme();
  return <View style={{ flexDirection: 'row', alignItems: align, justifyContent: justify, gap: gap ?? theme.space.sm, flexWrap: wrap ? 'wrap' : 'nowrap' }}>{children}</View>;
}

export function Divider() {
  const theme = useTheme();
  return <View style={{ height: theme.borderWidth.hairline, backgroundColor: theme.colors.border }} />;
}

export interface ListRowProps {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  trailing?: ReactNode;
  onPress?: () => void;
  destructive?: boolean;
}

export function ListRow({ title, subtitle, icon, trailing, onPress, destructive = false }: ListRowProps) {
  const theme = useTheme();
  const color = destructive ? theme.colors.danger : theme.colors.text;
  const content = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space.md, minHeight: theme.touchTarget, paddingVertical: theme.space.sm }}>
      {icon ? <Icon icon={icon} color={destructive ? theme.colors.danger : theme.colors.primary} /> : null}
      <View style={{ flex: 1, gap: theme.space.xxs }}>
        <Text variant={TextVariant.Subheading} style={{ color }}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant={TextVariant.Label} tone={TextTone.Muted}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {trailing}
      {onPress ? <Icon icon={ChevronRight} size={IconSize.Medium} color={theme.colors.textMuted} /> : null}
    </View>
  );
  if (!onPress) {
    return content;
  }
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={subtitle ? `${title}, ${subtitle}` : title} onPress={onPress} style={({ pressed }) => (pressed ? { opacity: theme.opacity.disabled } : undefined)}>
      {content}
    </Pressable>
  );
}

export function ProgressBar({ value, label }: { value: number; label: string }) {
  const theme = useTheme();
  const clamped = Math.max(0, Math.min(1, value));
  return (
    <View accessibilityRole="progressbar" accessibilityLabel={label} accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped * 100) }} style={{ gap: theme.space.xs }}>
      <Text variant={TextVariant.Label} tone={TextTone.Muted}>
        {label}
      </Text>
      <View style={{ height: theme.space.sm, borderRadius: theme.radius.pill, backgroundColor: theme.colors.neutralSubtle, overflow: 'hidden' }}>
        <View style={{ width: `${clamped * 100}%`, height: '100%', backgroundColor: theme.colors.primary, borderRadius: theme.radius.pill }} />
      </View>
    </View>
  );
}
