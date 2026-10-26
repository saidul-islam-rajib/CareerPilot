import { describe, expect, it } from 'vitest';
import { isoToZoned, zonedToday, zonedToIso } from './zoned-time';

describe('zoned time', () => {
  it('converts a wall-clock time in the user time zone to UTC and back', () => {
    expect(zonedToIso('2026-10-22', '10:00', 'Asia/Dhaka')).toBe('2026-10-22T04:00:00.000Z');
    expect(isoToZoned('2026-10-22T04:00:00.000Z', 'Asia/Dhaka')).toEqual({ date: '2026-10-22', time: '10:00' });
    expect(zonedToIso('2026-07-01', '09:30', 'Europe/London')).toBe('2026-07-01T08:30:00.000Z');
    expect(zonedToIso('2026-12-01', '09:30', 'Europe/London')).toBe('2026-12-01T09:30:00.000Z');
    expect(zonedToIso('2026-10-22', '24:00', 'Asia/Dhaka')).toBeUndefined();
    expect(zonedToIso('22/10/2026', '10:00', 'Asia/Dhaka')).toBeUndefined();
  });

  it('knows the local date for today', () => {
    expect(zonedToday(new Date('2026-10-20T20:30:00Z'), 'Asia/Dhaka')).toBe('2026-10-21');
    expect(zonedToday(new Date('2026-10-20T20:30:00Z'), 'UTC')).toBe('2026-10-20');
  });
});
