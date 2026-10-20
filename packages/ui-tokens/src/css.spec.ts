import { describe, expect, it } from 'vitest';
import { colorVariableName, themeCssVariables } from './css';
import { themes } from './themes';

describe('theme css variables', () => {
  it('names variables in kebab case', () => {
    expect(colorVariableName('primaryForeground')).toBe('--cp-primary-foreground');
  });

  it('exports every colour and radius of a theme', () => {
    const vars = themeCssVariables(themes.orchid);
    expect(vars['--cp-primary']).toBe('#6D28D9');
    expect(vars['--cp-radius-card']).toBe('16px');
    expect(Object.keys(vars)).toHaveLength(Object.keys(themes.orchid.colors).length + 3);
  });
});
