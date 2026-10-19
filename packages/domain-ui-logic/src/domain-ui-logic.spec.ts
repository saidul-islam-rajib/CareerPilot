import { describe, expect, it } from 'vitest';
import { EnumKey, StatusTone, SubmissionStatus, enumValues, isEnumValue } from './enums';
import { createEnumMetadataIndex } from './enum-metadata';
import { daysUntil, formatDate, formatMoney, formatMoneyRange, initials, moveItem } from './format';

const ctx = { locale: 'en-US', timeZone: 'Asia/Dhaka' };

describe('enums', () => {
  it('has the twelve submission statuses of requirements 20.2', () => {
    expect(enumValues(SubmissionStatus)).toHaveLength(12);
  });

  it('recognises valid and invalid values', () => {
    expect(isEnumValue(SubmissionStatus, 'confirmed')).toBe(true);
    expect(isEnumValue(SubmissionStatus, 'done')).toBe(false);
  });
});

describe('enum metadata index', () => {
  const index = createEnumMetadataIndex([
    { enumKey: EnumKey.SubmissionStatus, value: 'failed', labelKey: 'b', tone: StatusTone.Danger, sortOrder: 2, isTerminal: true, isActive: true },
    { enumKey: EnumKey.SubmissionStatus, value: 'confirmed', labelKey: 'a', tone: StatusTone.Success, sortOrder: 1, isTerminal: true, isActive: true },
    { enumKey: EnumKey.SubmissionStatus, value: 'old', labelKey: 'c', tone: StatusTone.Neutral, sortOrder: 3, isTerminal: false, isActive: false },
  ]);

  it('finds a value and lists active values in order', () => {
    expect(index.get(EnumKey.SubmissionStatus, 'confirmed')?.tone).toBe('success');
    expect(index.list(EnumKey.SubmissionStatus).map((r) => r.value)).toEqual(['confirmed', 'failed']);
    expect(index.list(EnumKey.OutcomeStatus)).toEqual([]);
  });
});

describe('format', () => {
  it('formats money from minor units', () => {
    expect(formatMoney({ amountMinor: 8_000_000, currency: 'USD' }, ctx)).toBe('$80,000');
  });

  it('formats a range and collapses equal bounds', () => {
    const min = { amountMinor: 5_000_000, currency: 'BDT' };
    expect(formatMoneyRange({ min, max: min }, ctx)).not.toContain('–');
    expect(formatMoneyRange({}, ctx)).toBeUndefined();
  });

  it('formats dates in the user time zone', () => {
    expect(formatDate('2026-10-20T20:00:00Z', ctx)).toBe('Oct 21, 2026');
  });

  it('counts days until a deadline', () => {
    expect(daysUntil('2026-10-25T00:00:00Z', new Date('2026-10-20T00:00:00Z'))).toBe(5);
  });

  it('builds initials', () => {
    expect(initials('  Saidul   Islam Rajib ')).toBe('SI');
  });

  it('moves list items for drag and drop ordering', () => {
    expect(moveItem(['a', 'b', 'c'], 0, 2)).toEqual(['b', 'c', 'a']);
    expect(moveItem(['a', 'b'], 0, 5)).toEqual(['a', 'b']);
  });
});
