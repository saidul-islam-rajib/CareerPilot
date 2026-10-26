import { useEffect, useMemo, type CSSProperties, type PropsWithChildren } from 'react';
import { useActiveTheme } from '@careerpilot/client-core';
import { themeCssVariables, type Theme } from '@careerpilot/ui-tokens';

interface ThemeScopeProps {
  theme: Theme;
  className?: string;
}

export function ThemeScope({ theme, children, className }: PropsWithChildren<ThemeScopeProps>) {
  const variables = useMemo(() => themeCssVariables(theme), [theme]);
  return (
    <div data-theme={theme.key} style={variables as CSSProperties} className={className}>
      {children}
    </div>
  );
}

function useDocumentTheme(theme: Theme) {
  useEffect(() => {
    const root = document.documentElement;
    const variables = themeCssVariables(theme);
    root.dataset.theme = theme.key;
    for (const [name, value] of Object.entries(variables)) {
      root.style.setProperty(name, value);
    }
    return () => {
      for (const name of Object.keys(variables)) {
        root.style.removeProperty(name);
      }
    };
  }, [theme]);
}

export function AppTheme({ theme, children, className }: PropsWithChildren<ThemeScopeProps>) {
  useDocumentTheme(theme);
  return (
    <ThemeScope theme={theme} className={className}>
      {children}
    </ThemeScope>
  );
}

export function ThemeFromConfig({ children, className }: PropsWithChildren<{ className?: string }>) {
  return (
    <AppTheme theme={useActiveTheme()} className={className}>
      {children}
    </AppTheme>
  );
}
