import { describe, expect, it } from 'vitest';
import { formatDecimal, formatMonth } from './format';

const ctx = { locale: 'en', timeZone: 'Asia/Dhaka' };

describe('formatMonth', () => {
  it('formats year-month values without shifting across time zones', () => {
    expect(formatMonth('2024-03', ctx)).toBe('Mar 2024');
    expect(formatMonth('2024-01', { locale: 'en', timeZone: 'America/Los_Angeles' })).toBe('Jan 2024');
  });

  it('leaves other values unchanged', () => {
    expect(formatMonth('2024', ctx)).toBe('2024');
  });

  it('formats decimals with locale rules', () => {
    expect(formatDecimal(1.25, ctx)).toBe('1.3');
    expect(formatDecimal(1200, ctx)).toBe('1,200');
  });
});
