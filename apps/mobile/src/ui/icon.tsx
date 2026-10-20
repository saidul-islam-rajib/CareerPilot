import type { LucideIcon } from 'lucide-react-native';
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
}

export function Icon({ icon: Glyph, size = IconSize.Medium, color }: IconProps) {
  const theme = useTheme();
  return <Glyph size={theme.iconSize[size]} color={color ?? theme.colors.text} strokeWidth={theme.iconStroke} accessibilityElementsHidden importantForAccessibility="no" />;
}
