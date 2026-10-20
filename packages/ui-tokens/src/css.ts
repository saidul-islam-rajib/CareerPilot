import type { Theme, ThemeColors } from './themes';

const PREFIX = '--cp';

function kebab(name: string): string {
  return name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
}

export function colorVariableName(name: keyof ThemeColors): string {
  return `${PREFIX}-${kebab(name)}`;
}

export function themeCssVariables(theme: Theme): Record<string, string> {
  const colors = Object.fromEntries(
    (Object.keys(theme.colors) as Array<keyof ThemeColors>).map((name) => [colorVariableName(name), theme.colors[name]]),
  );
  return {
    ...colors,
    [`${PREFIX}-radius-control`]: `${theme.radius.control}px`,
    [`${PREFIX}-radius-card`]: `${theme.radius.card}px`,
    [`${PREFIX}-radius-pill`]: `${theme.radius.pill}px`,
  };
}
