export interface Money {
  amountMinor: number;
  currency: string;
}

export interface MoneyRange {
  min?: Money;
  max?: Money;
  period?: string;
}

export interface FormatContext {
  locale: string;
  timeZone: string;
}

const MINOR_UNIT_DIGITS_FALLBACK = 2;
const DECIMAL_BASE = 10;
const MS_PER_DAY = 86_400_000;

function minorUnitDigits(currency: string, locale: string): number {
  const digits = new Intl.NumberFormat(locale, { style: 'currency', currency }).resolvedOptions().maximumFractionDigits;
  return digits ?? MINOR_UNIT_DIGITS_FALLBACK;
}

export function formatMoney(money: Money, ctx: FormatContext): string {
  const digits = minorUnitDigits(money.currency, ctx.locale);
  const major = money.amountMinor / DECIMAL_BASE ** digits;
  return new Intl.NumberFormat(ctx.locale, {
    style: 'currency',
    currency: money.currency,
    maximumFractionDigits: 0,
  }).format(major);
}

export function formatMoneyRange(range: MoneyRange, ctx: FormatContext): string | undefined {
  const parts = [range.min, range.max].filter((m): m is Money => m !== undefined).map((m) => formatMoney(m, ctx));
  if (parts.length === 0) {
    return undefined;
  }
  const unique = [...new Set(parts)];
  return unique.join(' – ');
}

export function formatDate(iso: string, ctx: FormatContext): string {
  return new Intl.DateTimeFormat(ctx.locale, {
    timeZone: ctx.timeZone,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(iso));
}

export function formatDateTime(iso: string, ctx: FormatContext): string {
  return new Intl.DateTimeFormat(ctx.locale, {
    timeZone: ctx.timeZone,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  }).format(new Date(iso));
}

export function daysUntil(iso: string, now: Date): number {
  return Math.ceil((new Date(iso).getTime() - now.getTime()) / MS_PER_DAY);
}

export function initials(fullName: string): string {
  return fullName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}

export function moveItem<T>(items: readonly T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) {
    return [...items];
  }
  const copy = [...items];
  const [moved] = copy.splice(from, 1);
  if (moved !== undefined) {
    copy.splice(to, 0, moved);
  }
  return copy;
}

const MONTH_VALUE = /^(\d{4})-(\d{2})$/;
const UTC = 'UTC';

export function formatMonth(value: string, ctx: FormatContext): string {
  const match = MONTH_VALUE.exec(value);
  if (!match) {
    return value;
  }
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, 1));
  return new Intl.DateTimeFormat(ctx.locale, { timeZone: UTC, month: 'short', year: 'numeric' }).format(date);
}

export function formatDecimal(value: number, ctx: FormatContext, maximumFractionDigits = 1): string {
  return new Intl.NumberFormat(ctx.locale, { maximumFractionDigits }).format(value);
}
