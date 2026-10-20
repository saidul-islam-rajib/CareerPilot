import { ApplicationMode, EnumKey, enumValues } from '@careerpilot/domain-ui-logic';
import type { Track } from '@careerpilot/api-client';
import { usePublicConfig, useEnumDisplay } from '@/core/config/public-config';
import { useT } from '@/core/i18n/i18n';
import { trackTitle } from '@/features/home/track-title';
import { Card, ErrorState, LoadingState, Screen, Segmented, Stepper, Text, TextTone, TextVariant } from '@/ui';
import { useSettings, useUpdateTrack } from './use-settings';

function TrackEditor({ track }: { track: Track }) {
  const t = useT();
  const display = useEnumDisplay();
  const { config } = usePublicConfig();
  const update = useUpdateTrack();
  const bounds = config.validationPolicy.track;
  const modes = enumValues(ApplicationMode).map((mode) => ({ value: mode, label: display(EnumKey.ApplicationMode, mode).label }));
  const setCount = (resultCount: number) => update.mutate({ id: track.id, update: { resultCount } });
  return (
    <Card>
      <Text variant={TextVariant.Heading}>{trackTitle(track, t)}</Text>
      <Text variant={TextVariant.Label} tone={TextTone.Muted}>
        {t('settings.resultCount')}
      </Text>
      <Stepper name={t('settings.resultCount')} value={track.resultCount} min={bounds.minResultCount} max={bounds.maxResultCount} onChange={setCount} />
      <Text variant={TextVariant.Label} tone={TextTone.Muted}>
        {t('settings.applicationMode')}
      </Text>
      <Segmented options={modes} value={track.mode} onChange={(mode) => update.mutate({ id: track.id, update: { mode } })} accessibilityLabel={t('settings.applicationMode')} />
    </Card>
  );
}

export function TracksScreen() {
  const t = useT();
  const settings = useSettings();
  if (settings.isPending) {
    return <LoadingState />;
  }
  if (settings.isError) {
    return <ErrorState onRetry={() => void settings.refetch()} />;
  }
  return (
    <Screen testID="tracks-screen">
      <Text tone={TextTone.Muted}>{t('settings.tracksBody')}</Text>
      {[...settings.data.tracks]
        .sort((a, b) => a.position - b.position)
        .map((track) => (
          <TrackEditor key={track.id} track={track} />
        ))}
    </Screen>
  );
}
