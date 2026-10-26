import type { ReactNode } from 'react';
import { useT } from '@careerpilot/client-core';
import { Pressable, View } from 'react-native';
import { Check } from '@/ui/icons';
import { useTheme } from '@/core/theme/theme';
import { Icon, IconSize } from './icon';
import { Text, TextTone, TextVariant } from './text';

export interface CheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  accessibilityLabel: string;
  children: ReactNode;
  error?: string;
}

export function Checkbox({ checked, onChange, accessibilityLabel, children, error }: CheckboxProps) {
  const theme = useTheme();
  const t = useT();
  const box = theme.iconSize.lg;
  return (
    <View style={{ gap: theme.space.xs }}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ checked }}
        onPress={() => onChange(!checked)}
        style={{ flexDirection: 'row', alignItems: 'flex-start', gap: theme.space.md, minHeight: theme.touchTarget }}
      >
        <View
          style={{
            width: box,
            height: box,
            borderRadius: theme.space.xs,
            borderWidth: theme.borderWidth.focus,
            borderColor: error ? theme.colors.danger : checked ? theme.colors.primary : theme.colors.neutral,
            backgroundColor: checked ? theme.colors.primary : theme.colors.background,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {checked ? <Icon icon={Check} size={IconSize.Small} color={theme.colors.primaryForeground} /> : null}
        </View>
        <View style={{ flex: 1 }}>{typeof children === 'string' || typeof children === 'number' ? <Text>{children}</Text> : children}</View>
      </Pressable>
      {error ? (
        <Text variant={TextVariant.Caption} tone={TextTone.Danger} accessibilityLiveRegion="polite">
          {t(error)}
        </Text>
      ) : null}
    </View>
  );
}
