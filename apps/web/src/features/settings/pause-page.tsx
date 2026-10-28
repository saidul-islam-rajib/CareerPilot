'use client';

import { useState } from 'react';
import { CalendarClock, CalendarDays, CalendarRange, Infinity as Endless, PauseCircle, PlayCircle, Search, Send } from 'lucide-react';
import type { PauseOption } from '@careerpilot/api-client';
import { pauseOptionKey, pauseOptionLabel, pauseUntil, useFormat, usePause, usePublicConfig, useServices, useSettings, useT } from '@careerpilot/client-core';
import { PauseDuration } from '@careerpilot/domain-ui-logic';
import { Button, Card, ChoiceCards, ErrorState, LoadingState, PageHeader, cn } from '@careerpilot/ui-web';

const OPTION_ICONS = {
  [PauseDuration.Days]: CalendarDays,
  [PauseDuration.Months]: CalendarRange,
  [PauseDuration.Years]: CalendarClock,
  [PauseDuration.Indefinite]: Endless,
  [PauseDuration.Until]: Endless,
} as const;

function StatusCard({ until, paused, onResume, resuming }: { until?: string; paused: boolean; onResume: () => void; resuming: boolean }) {
  const t = useT();
  const format = useFormat();
  const Glyph = paused ? PauseCircle : PlayCircle;
  return (
    <Card className={cn('flex-row items-center gap-4', paused ? 'border-warning bg-warning-subtle' : 'border-success bg-success-subtle')}>
      <span className={cn('flex size-12 shrink-0 items-center justify-center rounded-full', paused ? 'bg-card text-warning' : 'bg-card text-success')}>
        <Glyph className="size-6" aria-hidden />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="text-lg font-semibold text-foreground">{paused ? t('home.pausedTitle') : t('settings.pauseRunningTitle')}</p>
        <p className="text-sm text-foreground">
          {paused ? (until ? t('home.pausedUntil', { date: format.date(until) }) : t('home.pausedIndefinitely')) : t('settings.pauseRunningBody')}
        </p>
      </div>
      {paused ? (
        <Button icon={PlayCircle} onClick={onResume} loading={resuming}>
          {t('home.resume')}
        </Button>
      ) : null}
    </Card>
  );
}

export function PausePage() {
  const t = useT();
  const format = useFormat();
  const { clock } = useServices();
  const { config } = usePublicConfig();
  const settings = useSettings();
  const { pause, resume } = usePause();
  const options = config.pauseOptions;
  const [selected, setSelected] = useState(options[0] ? pauseOptionKey(options[0]) : '');
  const chosen = options.find((o) => pauseOptionKey(o) === selected);
  const current = settings.data?.pause;
  const endOf = (option: PauseOption) => pauseUntil(option, clock.now());
  const describe = (option: PauseOption) => {
    const end = endOf(option);
    return end ? t('settings.pauseUntilDate', { date: format.date(end.toISOString()) }) : t('settings.pauseUntilYouResume');
  };
  const chosenEnd = chosen ? endOf(chosen) : undefined;

  return (
    <>
      <PageHeader title={t('settings.pause')} description={t('settings.pauseBody')} />
      {settings.isPending ? <LoadingState /> : null}
      {settings.isError ? <ErrorState onRetry={() => void settings.refetch()} /> : null}
      {settings.isSuccess ? (
        <div className="grid max-w-4xl gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <div className="flex min-w-0 flex-col gap-6">
            <StatusCard until={current?.until} paused={Boolean(current)} onResume={() => resume.mutate()} resuming={resume.isPending} />
            <Card className="gap-4">
              <h2 className="text-lg font-semibold">{t('settings.pauseFor')}</h2>
              <ChoiceCards
                label={t('settings.pauseFor')}
                value={selected}
                onChange={setSelected}
                options={options.map((option) => ({
                  value: pauseOptionKey(option),
                  title: pauseOptionLabel(option, t),
                  description: describe(option),
                  icon: OPTION_ICONS[option.duration],
                }))}
              />
              <Button icon={PauseCircle} disabled={!chosen} onClick={() => chosen && pause.mutate(chosen)} loading={pause.isPending}>
                {chosenEnd ? t('settings.pauseConfirmUntil', { date: format.date(chosenEnd.toISOString()) }) : t('settings.pauseConfirmOpen')}
              </Button>
            </Card>
          </div>
          <Card className="gap-3 self-start">
            <h2 className="font-semibold">{t('settings.pauseWhile')}</h2>
            <ul className="flex flex-col gap-3 text-sm text-foreground">
              <li className="flex gap-2">
                <Send className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
                {t('settings.pauseEffectSend')}
              </li>
              <li className="flex gap-2">
                <Search className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                {t('settings.pauseEffectFind')}
              </li>
              <li className="flex gap-2">
                <PlayCircle className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
                {t('settings.pauseEffectResume')}
              </li>
            </ul>
          </Card>
        </div>
      ) : null}
    </>
  );
}
