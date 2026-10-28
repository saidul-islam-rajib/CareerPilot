import { ApplicationMode, EnumKey, enumValues } from '@careerpilot/domain-ui-logic';
import { trackTitle, useEnumDisplay, useSettings, useT, useTrackEditor } from '@careerpilot/client-core';
import type { Track } from '@careerpilot/api-client';
import { Card, ErrorState, LoadingState, Screen, Segmented, Stepper, Text, TextTone, TextVariant } from '@/ui';

function TrackEditor({ track, homeCountry }: { track: Track; homeCountry: string }) {
  const t = useT();
  const display = useEnumDisplay();
  const editor = useTrackEditor(track);
  const modes = enumValues(ApplicationMode).map((mode) => ({ value: mode, label: display(EnumKey.ApplicationMode, mode).label }));
  return (
    <Card>
      <Text variant={TextVariant.Heading}>{trackTitle(track, t, homeCountry)}</Text>
      <Text variant={TextVariant.Label} tone={TextTone.Muted}>
        {t('settings.resultCount')}
      </Text>
      <Stepper name={t('settings.resultCount')} value={editor.count} min={editor.min} max={editor.max} onChange={editor.changeCount} />
      <Text variant={TextVariant.Label} tone={TextTone.Muted}>
        {t('settings.applicationMode')}
      </Text>
      <Segmented options={modes} value={editor.mode} onChange={editor.changeMode} accessibilityLabel={t('settings.applicationMode')} />
      {editor.saving ? (
        <Text variant={TextVariant.Caption} tone={TextTone.Muted}>
          {t('common.saving')}
        </Text>
      ) : null}
      {editor.failed ? <Text tone={TextTone.Danger}>{t('settings.trackSaveFailed')}</Text> : null}
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
          <TrackEditor key={track.id} track={track} homeCountry={settings.data.homeCountry} />
        ))}
    </Screen>
  );
}
