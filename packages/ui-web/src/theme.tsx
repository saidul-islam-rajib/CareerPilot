import type { CSSProperties, PropsWithChildren } from 'react';
import { useActiveTheme } from '@careerpilot/client-core';
import { themeCssVariables, type Theme } from '@careerpilot/ui-tokens';

export function ThemeScope({ theme, children, className }: PropsWithChildren<{ theme: Theme; className?: string }>) {
  return (
    <div data-theme={theme.key} style={themeCssVariables(theme) as CSSProperties} className={className}>
      {children}
    </div>
  );
}

export function ThemeFromConfig({ children, className }: PropsWithChildren<{ className?: string }>) {
  return (
    <ThemeScope theme={useActiveTheme()} className={className}>
      {children}
    </ThemeScope>
  );
}
