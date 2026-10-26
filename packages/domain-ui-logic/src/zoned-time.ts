export interface ZonedParts {
  date: string;
  time: string;
}

const DATE_VALUE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_VALUE = /^([01]\d|2[0-3]):([0-5]\d)$/;
const PART_LOCALE = 'en-CA';
const PAD = 2;
const MONTH_OFFSET = 1;

function wallClock(at: number, timeZone: string): Record<string, number> {
  const parts = new Intl.DateTimeFormat(PART_LOCALE, {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(at));
  return Object.fromEntries(parts.filter((p) => p.type !== 'literal').map((p) => [p.type, Number(p.value)]));
}

function offsetAt(at: number, timeZone: string): number {
  const wall = wallClock(at, timeZone);
  const asUtc = Date.UTC(wall.year ?? 0, (wall.month ?? MONTH_OFFSET) - MONTH_OFFSET, wall.day, wall.hour, wall.minute, wall.second);
  return asUtc - at;
}

function pad(value: number): string {
  return String(value).padStart(PAD, '0');
}

export function zonedToIso(date: string, time: string, timeZone: string): string | undefined {
  const day = DATE_VALUE.exec(date);
  const clock = TIME_VALUE.exec(time);
  if (!day || !clock) {
    return undefined;
  }
  const guess = Date.UTC(Number(day[1]), Number(day[2]) - MONTH_OFFSET, Number(day[3]), Number(clock[1]), Number(clock[2]));
  const first = guess - offsetAt(guess, timeZone);
  return new Date(guess - offsetAt(first, timeZone)).toISOString();
}

export function isoToZoned(iso: string, timeZone: string): ZonedParts {
  const wall = wallClock(Date.parse(iso), timeZone);
  return {
    date: `${wall.year}-${pad(wall.month ?? MONTH_OFFSET)}-${pad(wall.day ?? MONTH_OFFSET)}`,
    time: `${pad(wall.hour ?? 0)}:${pad(wall.minute ?? 0)}`,
  };
}

export function zonedToday(now: Date, timeZone: string): string {
  return isoToZoned(now.toISOString(), timeZone).date;
}
