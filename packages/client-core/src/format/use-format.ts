import { useMemo } from 'react';
import type { EntryPeriod, EntryValue } from '@careerpilot/dynamic-forms';
import {
  daysUntil,
  formatDate,
  formatDateTime,
  formatDecimal,
  formatMoneyRange,
  formatMonth,
  type FormatContext,
  type MoneyRange,
} from '@careerpilot/domain-ui-logic';
import { usePublicConfig } from '../config/public-config';
import { useT } from '../i18n/i18n';
import { useServices } from '../services/app-services';

const BYTES_PER_KILOBYTE = 1024;
const BYTES_PER_MEGABYTE = BYTES_PER_KILOBYTE * BYTES_PER_KILOBYTE;

export function useFormat() {
  const { config } = usePublicConfig();
  const { clock } = useServices();
  const t = useT();
  return useMemo(() => {
    const ctx: FormatContext = { locale: config.locale, timeZone: config.defaultTimeZone };
    return {
      date: (iso: string) => formatDate(iso, ctx),
      dateTime: (iso: string) => formatDateTime(iso, ctx),
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
        bytes < BYTES_PER_MEGABYTE
          ? t('common.kilobytes', { value: formatDecimal(Math.max(1, Math.round(bytes / BYTES_PER_KILOBYTE)), ctx) })
          : t('common.megabytes', { value: formatDecimal(bytes / BYTES_PER_MEGABYTE, ctx) }),
    };
  }, [clock, config.defaultTimeZone, config.locale, t]);
}
