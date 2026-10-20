import type { PauseDuration } from '@careerpilot/domain-ui-logic';
import type { PauseOption } from '@careerpilot/api-client';
import type { Translate } from '@careerpilot/i18n';

export function pauseOptionKey(option: PauseOption): string {
  return `${option.duration}:${option.amount ?? ''}`;
}

export function pauseOptionLabel(option: PauseOption, t: Translate): string {
  const labels: Record<PauseDuration, string> = {
    days: t('settings.pauseDays', { count: option.amount ?? 0 }),
    months: t('settings.pauseMonths', { count: option.amount ?? 0 }),
    years: t('settings.pauseYears', { count: option.amount ?? 0 }),
    indefinite: t('settings.pauseIndefinite'),
    until: t('settings.pauseIndefinite'),
  };
  return labels[option.duration];
}
