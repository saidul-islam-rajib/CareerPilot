import { useMemo } from 'react';
import type { EntryPeriod, EntryValue } from '@careerpilot/dynamic-forms';
import { daysUntil, formatDate, formatDateTime, formatDecimal, formatMoneyRange, formatMonth, formatTimeOfDay, type FormatContext, type MoneyRange } from '@careerpilot/domain-ui-logic';
import { usePublicConfig } from '../config/public-config';
import { useT } from '../i18n/i18n';
import { useServices } from '../services/app-services';

const BYTES_PER_KILOBYTE = 1024;
const BYTES_PER_MEGABYTE = BYTES_PER_KILOBYTE * BYTES_PER_KILOBYTE;
const SECONDS_PER_MINUTE = 60;
const MINUTES_PER_HOUR = 60;
const HOURS_PER_DAY = 24;
const MS_PER_SECOND = 1000;

export function useFormat() {
  const { config } = usePublicConfig();
  const { clock } = useServices();
  const t = useT();
  return useMemo(() => {
    const ctx: FormatContext = { locale: config.locale, timeZone: config.defaultTimeZone };
    return {
      date: (iso: string) => formatDate(iso, ctx),
      dateTime: (iso: string) => formatDateTime(iso, ctx),
      timeOf: (iso: string) => new Intl.DateTimeFormat(ctx.locale, { hour: 'numeric', minute: '2-digit', timeZone: ctx.timeZone }).format(new Date(iso)),
      time: (value: string) => formatTimeOfDay(value, ctx),
      money: (range?: MoneyRange) => (range ? formatMoneyRange(range, ctx) : undefined),
      deadline: (iso?: string) => {
        if (!iso) {
          return t('common.notStated');
        }
        const days = daysUntil(iso, clock.now());
        if (days < 0) {
          return t('common.closed');
        }
        return days === 0 ? t('common.dueToday') : t('common.daysLeft', { count: days });
      },
      daysLeft: (iso: string) => daysUntil(iso, clock.now()),
      month: (value: EntryValue | undefined) => (typeof value === 'string' ? formatMonth(value, ctx) : value === undefined || value === null ? '' : String(value)),
      period: (period: EntryPeriod) => {
        const start = typeof period.start === 'string' ? formatMonth(period.start, ctx) : period.start === undefined ? '' : String(period.start);
        const end = period.ongoing ? t('profile.present') : typeof period.end === 'string' ? formatMonth(period.end, ctx) : period.end === undefined ? '' : String(period.end);
        return [start, end].filter(Boolean).join(' – ');
      },
      fileSize: (bytes: number) =>
        bytes <= 0
          ? ''
          : bytes < BYTES_PER_MEGABYTE
          ? t('common.kilobytes', { value: formatDecimal(Math.max(1, Math.round(bytes / BYTES_PER_KILOBYTE)), ctx) })
          : t('common.megabytes', { value: formatDecimal(bytes / BYTES_PER_MEGABYTE, ctx) }),
      duration: (seconds: number) => {
        const minutes = Math.floor(seconds / SECONDS_PER_MINUTE);
        const hours = Math.floor(minutes / MINUTES_PER_HOUR);
        if (hours > 0) {
          return t('format.hoursMinutes', { hours, minutes: minutes % MINUTES_PER_HOUR });
        }
        return minutes > 0 ? t('format.minutes', { count: minutes }) : t('format.underMinute');
      },
      ago: (iso: string) => {
        const minutes = Math.floor((clock.now().getTime() - new Date(iso).getTime()) / (MS_PER_SECOND * SECONDS_PER_MINUTE));
        if (minutes < 1) {
          return t('format.justNow');
        }
        if (minutes < MINUTES_PER_HOUR) {
          return t('format.minutesAgo', { count: minutes });
        }
        const hours = Math.floor(minutes / MINUTES_PER_HOUR);
        return hours < HOURS_PER_DAY ? t('format.hoursAgo', { count: hours }) : formatDateTime(iso, ctx);
      },
    };
  }, [clock, config.defaultTimeZone, config.locale, t]);
}
