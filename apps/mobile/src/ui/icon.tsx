import { Platform } from 'react-native';
import type { LucideIcon } from '@/ui/icons';
import { useTheme } from '@/core/theme/theme';

export const IconSize = {
  Small: 'sm',
  Medium: 'md',
  Large: 'lg',
} as const;
export type IconSize = (typeof IconSize)[keyof typeof IconSize];

export interface IconProps {
  icon: LucideIcon;
  size?: IconSize;
  color?: string;
  fill?: string;
}

const HIDDEN_FROM_SCREEN_READERS = Platform.select({
  web: { 'aria-hidden': true },
  default: { accessibilityElementsHidden: true, importantForAccessibility: 'no' as const },
});

export function Icon({ icon: Glyph, size = IconSize.Medium, color, fill }: IconProps) {
  const theme = useTheme();
  return <Glyph size={theme.iconSize[size]} color={color ?? theme.colors.text} fill={fill ?? 'none'} strokeWidth={theme.iconStroke} {...HIDDEN_FROM_SCREEN_READERS} />;
}
