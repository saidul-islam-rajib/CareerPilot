import { ActivityIndicator, Pressable, View, type PressableProps, type ViewStyle } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { useTheme, type AppTheme } from '@/core/theme/theme';
import { Icon, IconSize } from './icon';
import { Text, TextVariant } from './text';

export const ButtonVariant = {
  Primary: 'primary',
  Secondary: 'secondary',
  Outline: 'outline',
  Ghost: 'ghost',
  Destructive: 'destructive',
} as const;
export type ButtonVariant = (typeof ButtonVariant)[keyof typeof ButtonVariant];

export interface ButtonProps extends Omit<PressableProps, 'children' | 'style'> {
  label: string;
  variant?: ButtonVariant;
  icon?: LucideIcon;
  loading?: boolean;
  fullWidth?: boolean;
  style?: ViewStyle;
}

interface Palette {
  background: string;
  pressed: string;
  foreground: string;
  border: string;
}

function palette(theme: AppTheme, variant: ButtonVariant): Palette {
  const c = theme.colors;
  const palettes: Record<ButtonVariant, Palette> = {
    primary: { background: c.primary, pressed: c.primaryHover, foreground: c.primaryForeground, border: c.primary },
    secondary: { background: c.primarySubtle, pressed: c.border, foreground: c.primary, border: c.primarySubtle },
    outline: { background: c.background, pressed: c.surface, foreground: c.text, border: c.input },
    ghost: { background: 'transparent', pressed: c.neutralSubtle, foreground: c.primary, border: 'transparent' },
    destructive: { background: c.danger, pressed: c.danger, foreground: c.primaryForeground, border: c.danger },
  };
  return palettes[variant];
}

export function Button({ label, variant = ButtonVariant.Primary, icon, loading = false, fullWidth = false, disabled, style, ...rest }: ButtonProps) {
  const theme = useTheme();
  const colors = palette(theme, variant);
  const inactive = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!inactive, busy: loading }}
      disabled={inactive}
      hitSlop={theme.space.xs}
      style={({ pressed }) => [
        {
          minHeight: theme.touchTarget,
          paddingHorizontal: theme.space.lg,
          borderRadius: theme.radius.control,
          borderWidth: theme.borderWidth.hairline,
          borderColor: colors.border,
          backgroundColor: pressed ? colors.pressed : colors.background,
          opacity: inactive ? theme.opacity.disabled : 1,
          alignItems: 'center',
          justifyContent: 'center',
          alignSelf: fullWidth ? 'stretch' : 'auto',
        },
        style,
      ]}
      {...rest}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space.sm }}>
        {loading ? <ActivityIndicator color={colors.foreground} /> : icon ? <Icon icon={icon} size={IconSize.Medium} color={colors.foreground} /> : null}
        <Text variant={TextVariant.Subheading} style={{ color: colors.foreground }}>
          {label}
        </Text>
      </View>
    </Pressable>
  );
}
