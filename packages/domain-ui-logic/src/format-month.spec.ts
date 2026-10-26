import { describe, expect, it } from 'vitest';
import { formatDecimal, formatMonth, formatTimeOfDay } from './format';

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

describe('formatTimeOfDay', () => {
  it('shows a stored HH:MM time in the user locale', () => {
    expect(formatTimeOfDay('18:00', { locale: 'en-US', timeZone: 'Asia/Dhaka' }).replace(/\s/gu, ' ')).toBe('6:00 PM');
    expect(formatTimeOfDay('08:30', { locale: 'en-GB', timeZone: 'Asia/Dhaka' })).toBe('8:30');
    expect(formatTimeOfDay('7pm', { locale: 'en-US', timeZone: 'Asia/Dhaka' })).toBe('7pm');
  });
});
