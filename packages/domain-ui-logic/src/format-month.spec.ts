import { describe, expect, it } from 'vitest';
import { formatCountdown, formatDecimal, formatMonth, formatTimeOfDay } from './format';

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

describe('formatCountdown', () => {
  it('shows minutes and two-digit seconds', () => {
    expect(formatCountdown(300)).toBe('5:00');
    expect(formatCountdown(299)).toBe('4:59');
    expect(formatCountdown(61)).toBe('1:01');
    expect(formatCountdown(9)).toBe('0:09');
  });

  it('never shows negative or fractional time', () => {
    expect(formatCountdown(-4)).toBe('0:00');
    expect(formatCountdown(4.2)).toBe('0:05');
  });
});
