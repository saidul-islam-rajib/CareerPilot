import { describe, expect, it } from 'vitest';
import { AA_LARGE_TEXT, AA_NORMAL_TEXT, contrastRatio, parseHex } from './contrast';
import { THEME_KEYS, ThemeKey, isThemeKey, resolveTheme, themes } from './themes';

describe('themes', () => {
  it('defines exactly the three admin-selectable themes', () => {
    expect([...THEME_KEYS].sort()).toEqual(['horizon', 'orchid', 'sober']);
  });

  it.each(THEME_KEYS)('%s meets WCAG AA contrast for text pairs', (key) => {
    const c = themes[key].colors;
    const textPairs: Array<[string, string]> = [
      [c.text, c.background],
      [c.text, c.surface],
      [c.textMuted, c.background],
      [c.textMuted, c.surface],
      [c.primary, c.background],
      [c.primaryForeground, c.primary],
      [c.primaryForeground, c.primaryHover],
      [c.accentForeground, c.accent],
      [c.primary, c.primarySubtle],
      [c.success, c.successSubtle],
      [c.warning, c.warningSubtle],
      [c.danger, c.dangerSubtle],
      [c.info, c.infoSubtle],
      [c.neutral, c.neutralSubtle],
    ];
    for (const [fg, bg] of textPairs) {
      expect(contrastRatio(fg, bg), `${fg} on ${bg}`).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
    }
  });

  it.each(THEME_KEYS)('%s input border is visible against the background', (key) => {
    const c = themes[key].colors;
    expect(contrastRatio(c.neutral, c.background)).toBeGreaterThanOrEqual(AA_LARGE_TEXT);
  });

  it('resolves unknown keys to the fallback theme', () => {
    expect(resolveTheme('unknown', ThemeKey.Sober).key).toBe('sober');
    expect(resolveTheme('orchid', ThemeKey.Sober).key).toBe('orchid');
    expect(isThemeKey(42)).toBe(false);
  });
});

describe('contrast', () => {
  it('computes the known black-on-white ratio', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 1);
  });

  it('parses short hex and rejects invalid input', () => {
    expect(parseHex('#fff')).toEqual([255, 255, 255]);
    expect(() => parseHex('#zzzzzz')).toThrow();
  });
});
