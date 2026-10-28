import { PauseDuration } from '@careerpilot/domain-ui-logic';
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

export function pauseUntil(option: PauseOption, now: Date): Date | undefined {
  const date = new Date(now.getTime());
  const amount = option.amount ?? 0;
  switch (option.duration) {
    case PauseDuration.Days:
      date.setDate(date.getDate() + amount);
      return date;
    case PauseDuration.Months:
      date.setMonth(date.getMonth() + amount);
      return date;
    case PauseDuration.Years:
      date.setFullYear(date.getFullYear() + amount);
      return date;
    default:
      return undefined;
  }
}
