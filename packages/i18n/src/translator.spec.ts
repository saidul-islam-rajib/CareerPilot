import { describe, expect, it } from 'vitest';
import { catalogs } from './index';
import { createTranslator, flattenKeys, hasKey, interpolate } from './translator';

describe('translator', () => {
  const t = createTranslator({ a: { b: 'Hello {name}' }, plain: 'Plain' }, { only: 'Fallback' });

  it('resolves nested keys with parameters', () => {
    expect(t('a.b', { name: 'Rajib' })).toBe('Hello Rajib');
  });

  it('uses the fallback catalog and returns the key when missing', () => {
    expect(t('only')).toBe('Fallback');
    expect(t('missing.key')).toBe('missing.key');
    expect(t('a')).toBe('a');
  });

  it('keeps unknown placeholders', () => {
    expect(interpolate('{x} and {y}', { x: 1 })).toBe('1 and {y}');
  });

  it('lists and checks keys', () => {
    expect(flattenKeys({ a: { b: 'x' }, c: 'y' })).toEqual(['a.b', 'c']);
    expect(hasKey({ a: 'x' }, 'a')).toBe(true);
  });
});

describe('english catalog', () => {
  const keys = flattenKeys(catalogs.en);

  it('has no empty strings', () => {
    const t = createTranslator(catalogs.en);
    for (const key of keys) {
      expect(t(key).trim().length, key).toBeGreaterThan(0);
    }
  });

  it('contains the Team Sober credit', () => {
    expect(hasKey(catalogs.en, 'credits.developedBy')).toBe(true);
  });
});
