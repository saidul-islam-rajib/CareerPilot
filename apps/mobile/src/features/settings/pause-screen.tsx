import { useState } from 'react';
import { View } from 'react-native';
import type { PauseOption } from '@careerpilot/api-client';
import { pauseOptionKey, pauseOptionLabel, pauseUntil, useFormat, usePause, usePublicConfig, useServices, useSettings, useT } from '@careerpilot/client-core';
import { PauseDuration, StatusTone } from '@careerpilot/domain-ui-logic';
import { CalendarClock, CalendarDays, CalendarRange, InfinityIcon, PauseCircle, PlayCircle, Search, Send, type LucideIcon } from '@/ui/icons';
import { useTheme } from '@/core/theme/theme';
import { Banner, Button, ButtonVariant, Card, ChoiceList, ErrorState, Icon, IconSize, LoadingState, Screen, Text, TextTone, TextVariant } from '@/ui';

const OPTION_ICONS: Record<PauseDuration, LucideIcon> = {
  [PauseDuration.Days]: CalendarDays,
  [PauseDuration.Months]: CalendarRange,
  [PauseDuration.Years]: CalendarClock,
  [PauseDuration.Indefinite]: InfinityIcon,
  [PauseDuration.Until]: InfinityIcon,
};

function Effect({ icon, color, text }: { icon: LucideIcon; color: string; text: string }) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: theme.space.sm, alignItems: 'flex-start' }}>
      <Icon icon={icon} size={IconSize.Small} color={color} />
      <Text style={{ flex: 1 }}>{text}</Text>
    </View>
  );
}

export function PauseScreen() {
  const t = useT();
  const theme = useTheme();
  const format = useFormat();
  const { clock } = useServices();
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
  const endOf = (option: PauseOption) => pauseUntil(option, clock.now());
  const describe = (option: PauseOption) => {
    const end = endOf(option);
    return end ? t('settings.pauseUntilDate', { date: format.date(end.toISOString()) }) : t('settings.pauseUntilYouResume');
  };
  const chosenEnd = chosen ? endOf(chosen) : undefined;

  return (
    <Screen testID="pause-screen">
      {current ? (
        <Banner
          tone={StatusTone.Warning}
          icon={PauseCircle}
          title={t('home.pausedTitle')}
          body={current.until ? t('home.pausedUntil', { date: format.date(current.until) }) : t('home.pausedIndefinitely')}
          action={<Button label={t('home.resume')} icon={PlayCircle} onPress={() => resume.mutate()} loading={resume.isPending} testID="resume" />}
        />
      ) : (
        <Banner tone={StatusTone.Success} icon={PlayCircle} title={t('settings.pauseRunningTitle')} body={t('settings.pauseRunningBody')} />
      )}
      <Card>
        <ChoiceList
          label={t('settings.pauseFor')}
          value={selected}
          onChange={setSelected}
          choices={options.map((option) => ({
            value: pauseOptionKey(option),
            label: pauseOptionLabel(option, t),
            description: describe(option),
            icon: OPTION_ICONS[option.duration],
          }))}
        />
        <Button
          label={chosenEnd ? t('settings.pauseConfirmUntil', { date: format.date(chosenEnd.toISOString()) }) : t('settings.pauseConfirmOpen')}
          icon={PauseCircle}
          variant={ButtonVariant.Primary}
          disabled={!chosen}
          onPress={() => chosen && pause.mutate(chosen)}
          loading={pause.isPending}
          fullWidth
          testID="pause-confirm"
        />
      </Card>
      <Card>
        <Text variant={TextVariant.Subheading}>{t('settings.pauseWhile')}</Text>
        <Effect icon={Send} color={theme.colors.warning} text={t('settings.pauseEffectSend')} />
        <Effect icon={Search} color={theme.colors.primary} text={t('settings.pauseEffectFind')} />
        <Effect icon={PlayCircle} color={theme.colors.success} text={t('settings.pauseEffectResume')} />
        <Text variant={TextVariant.Caption} tone={TextTone.Muted}>
          {t('settings.pauseBody')}
        </Text>
      </Card>
    </Screen>
  );
}
