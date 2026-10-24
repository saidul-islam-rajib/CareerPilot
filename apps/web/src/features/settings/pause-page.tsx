'use client';

import { useState } from 'react';
import { PauseCircle, PlayCircle } from 'lucide-react';
import { pauseOptionKey, pauseOptionLabel, useFormat, usePause, usePublicConfig, useSettings, useT } from '@careerpilot/client-core';
import { StatusTone } from '@careerpilot/domain-ui-logic';
import { Banner, Button, Card, ErrorState, LoadingState, PageHeader, Segmented } from '@careerpilot/ui-web';

export function PausePage() {
  const t = useT();
  const format = useFormat();
  const { config } = usePublicConfig();
  const settings = useSettings();
  const { pause, resume } = usePause();
  const options = config.pauseOptions;
  const [selected, setSelected] = useState(options[0] ? pauseOptionKey(options[0]) : '');
  const chosen = options.find((o) => pauseOptionKey(o) === selected);
  const current = settings.data?.pause;

  return (
    <>
      <PageHeader title={t('settings.pause')} description={t('settings.pauseBody')} />
      {settings.isPending ? <LoadingState /> : null}
      {settings.isError ? <ErrorState onRetry={() => void settings.refetch()} /> : null}
      {current ? (
        <Banner
          tone={StatusTone.Warning}
          icon={PauseCircle}
          title={t('home.pausedTitle')}
          body={current.until ? t('home.pausedUntil', { date: format.date(current.until) }) : t('home.pausedIndefinitely')}
          action={
            <Button variant="outline" icon={PlayCircle} onClick={() => resume.mutate()} loading={resume.isPending}>
              {t('home.resume')}
            </Button>
          }
        />
      ) : null}
      {settings.isSuccess ? (
        <Card className="max-w-xl gap-4">
          <p className="font-medium">{t('settings.pauseFor')}</p>
          <Segmented options={options.map((option) => ({ value: pauseOptionKey(option), label: pauseOptionLabel(option, t) }))} value={selected} onChange={setSelected} label={t('settings.pauseFor')} />
          <Button icon={PauseCircle} disabled={!chosen} onClick={() => chosen && pause.mutate(chosen)} loading={pause.isPending}>
            {t('settings.pauseConfirm')}
          </Button>
        </Card>
      ) : null}
    </>
  );
}
