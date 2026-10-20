import { Pressable, View } from 'react-native';
import { useTheme } from '@/core/theme/theme';
import { Text, TextVariant } from './text';

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
}

export interface SegmentedProps<T extends string> {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  accessibilityLabel: string;
}

export function Segmented<T extends string>({ options, value, onChange, accessibilityLabel }: SegmentedProps<T>) {
  const theme = useTheme();
  return (
    <View accessibilityRole="tablist" accessibilityLabel={accessibilityLabel} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.space.sm }}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={option.label}
            onPress={() => onChange(option.value)}
            style={{
              minHeight: theme.touchTarget,
              justifyContent: 'center',
              paddingHorizontal: theme.space.lg,
              borderRadius: theme.radius.pill,
              borderWidth: theme.borderWidth.hairline,
              borderColor: selected ? theme.colors.primary : theme.colors.input,
              backgroundColor: selected ? theme.colors.primary : theme.colors.background,
            }}
          >
            <Text variant={TextVariant.Label} style={{ color: selected ? theme.colors.primaryForeground : theme.colors.text }}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
