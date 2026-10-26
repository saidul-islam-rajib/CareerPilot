import { useState } from 'react';
import { pauseOptionKey, pauseOptionLabel, useFormat, usePause, usePublicConfig, useSettings, useT } from '@careerpilot/client-core';
import { PauseCircle, PlayCircle } from '@/ui/icons';
import { StatusTone } from '@careerpilot/domain-ui-logic';
import { Banner, Button, ButtonVariant, Card, ErrorState, LoadingState, Screen, Segmented, Text, TextTone } from '@/ui';

export function PauseScreen() {
  const t = useT();
  const format = useFormat();
  const { config } = usePublicConfig();
  const settings = useSettings();
  const { pause, resume } = usePause();
  const options = config.pauseOptions;
  const [selected, setSelected] = useState(options[0] ? pauseOptionKey(options[0]) : '');

  if (settings.isPending) {
    return <LoadingState />;
  }
  if (settings.isError) {
    return <ErrorState onRetry={() => void settings.refetch()} />;
  }
  const current = settings.data.pause;
  const chosen = options.find((o) => pauseOptionKey(o) === selected);

  return (
    <Screen testID="pause-screen">
      {current ? (
        <Banner
          tone={StatusTone.Warning}
          icon={PauseCircle}
          title={t('home.pausedTitle')}
          body={current.until ? t('home.pausedUntil', { date: format.date(current.until) }) : t('home.pausedIndefinitely')}
          action={<Button label={t('home.resume')} icon={PlayCircle} variant={ButtonVariant.Outline} onPress={() => resume.mutate()} loading={resume.isPending} testID="resume" />}
        />
      ) : null}
      <Card>
        <Text tone={TextTone.Muted}>{t('settings.pauseBody')}</Text>
        <Text>{t('settings.pauseFor')}</Text>
        <Segmented
          options={options.map((option) => ({ value: pauseOptionKey(option), label: pauseOptionLabel(option, t) }))}
          value={selected}
          onChange={setSelected}
          accessibilityLabel={t('settings.pauseFor')}
        />
        <Button label={t('settings.pauseConfirm')} icon={PauseCircle} disabled={!chosen} onPress={() => chosen && pause.mutate(chosen)} loading={pause.isPending} fullWidth testID="pause-confirm" />
      </Card>
    </Screen>
  );
}
