import { useMemo } from 'react';
import {
  daysUntil,
  formatDate,
  formatDateTime,
  formatMoneyRange,
  type FormatContext,
  type MoneyRange,
} from '@careerpilot/domain-ui-logic';
import { usePublicConfig } from '@/core/config/public-config';
import { useT } from '@/core/i18n/i18n';
import { useServices } from '@/core/services/app-services';

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
    };
  }, [clock, config.defaultTimeZone, config.locale, t]);
}
