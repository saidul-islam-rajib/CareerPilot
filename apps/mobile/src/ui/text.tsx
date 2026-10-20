import { Text as RNText, type TextProps as RNTextProps, type TextStyle } from 'react-native';
import { useTheme, type AppTheme } from '@/core/theme/theme';

export const TextVariant = {
  Display: 'display',
  Title: 'title',
  Heading: 'heading',
  Subheading: 'subheading',
  Body: 'body',
  Label: 'label',
  Caption: 'caption',
} as const;
export type TextVariant = (typeof TextVariant)[keyof typeof TextVariant];

export const TextTone = {
  Default: 'default',
  Muted: 'muted',
  Primary: 'primary',
  Danger: 'danger',
  Success: 'success',
  Warning: 'warning',
  Inverse: 'inverse',
} as const;
export type TextTone = (typeof TextTone)[keyof typeof TextTone];

export interface TextProps extends RNTextProps {
  variant?: TextVariant;
  tone?: TextTone;
  align?: TextStyle['textAlign'];
}

function variantStyle(theme: AppTheme, variant: TextVariant): TextStyle {
  const { fontSize: fs, lineHeight: lh, fontWeight: fw } = theme;
  const styles: Record<TextVariant, TextStyle> = {
    display: { fontSize: fs.display, lineHeight: lh.display, fontWeight: fw.bold },
    title: { fontSize: fs.xxl, lineHeight: lh.xxl, fontWeight: fw.bold },
    heading: { fontSize: fs.lg, lineHeight: lh.lg, fontWeight: fw.semibold },
    subheading: { fontSize: fs.md, lineHeight: lh.md, fontWeight: fw.semibold },
    body: { fontSize: fs.md, lineHeight: lh.md, fontWeight: fw.regular },
    label: { fontSize: fs.sm, lineHeight: lh.sm, fontWeight: fw.medium },
    caption: { fontSize: fs.xs, lineHeight: lh.xs, fontWeight: fw.regular },
  };
  return styles[variant];
}

function toneColor(theme: AppTheme, tone: TextTone): string {
  const c = theme.colors;
  const colors: Record<TextTone, string> = {
    default: c.text,
    muted: c.textMuted,
    primary: c.primary,
    danger: c.danger,
    success: c.success,
    warning: c.warning,
    inverse: c.primaryForeground,
  };
  return colors[tone];
}

export function Text({ variant = TextVariant.Body, tone = TextTone.Default, align, style, ...rest }: TextProps) {
  const theme = useTheme();
  const accessibilityRole = variant === TextVariant.Display || variant === TextVariant.Title || variant === TextVariant.Heading ? 'header' : undefined;
  return (
    <RNText
      accessibilityRole={accessibilityRole}
      maxFontSizeMultiplier={theme.fontScaleMax}
      style={[variantStyle(theme, variant), { color: toneColor(theme, tone), textAlign: align }, style]}
      {...rest}
    />
  );
}
