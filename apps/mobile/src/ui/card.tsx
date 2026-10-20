import { Pressable, View, type ViewProps, type ViewStyle } from 'react-native';
import { useTheme } from '@/core/theme/theme';

export interface CardProps extends ViewProps {
  onPress?: () => void;
  accessibilityLabel?: string;
  padded?: boolean;
}

export function Card({ onPress, padded = true, style, children, accessibilityLabel, ...rest }: CardProps) {
  const theme = useTheme();
  const base: ViewStyle = {
    backgroundColor: theme.colors.card,
    borderColor: theme.colors.border,
    borderWidth: theme.borderWidth.hairline,
    borderRadius: theme.radius.card,
    padding: padded ? theme.space.lg : 0,
    gap: theme.space.sm,
  };
  if (!onPress) {
    return (
      <View style={[base, style]} accessibilityLabel={accessibilityLabel} {...rest}>
        {children}
      </View>
    );
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [base, pressed && { backgroundColor: theme.colors.surface }, style as ViewStyle]}
    >
      {children}
    </Pressable>
  );
}
