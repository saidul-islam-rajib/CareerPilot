'use client';

import type { Track } from '@careerpilot/api-client';
import { trackTitle, useEnumDisplay, usePublicConfig, useSettings, useT, useUpdateTrack } from '@careerpilot/client-core';
import { ApplicationMode, EnumKey, enumValues } from '@careerpilot/domain-ui-logic';
import { Card, CardTitle, ErrorState, LoadingState, PageHeader, Segmented, Stepper } from '@careerpilot/ui-web';

function TrackEditor({ track }: { track: Track }) {
  const t = useT();
  const display = useEnumDisplay();
  const { config } = usePublicConfig();
  const update = useUpdateTrack();
  const bounds = config.validationPolicy.track;
  const modes = enumValues(ApplicationMode).map((mode) => ({ value: mode, label: display(EnumKey.ApplicationMode, mode).label }));
  return (
    <Card className="gap-3">
      <CardTitle className="text-lg">{trackTitle(track, t)}</CardTitle>
      <p className="text-sm text-muted">{t('settings.resultCount')}</p>
      <Stepper
        name={t('settings.resultCount')}
        value={track.resultCount}
        min={bounds.minResultCount}
        max={bounds.maxResultCount}
        onChange={(resultCount) => update.mutate({ id: track.id, update: { resultCount } })}
      />
      <p className="text-sm text-muted">{t('settings.applicationMode')}</p>
      <Segmented options={modes} value={track.mode} onChange={(mode) => update.mutate({ id: track.id, update: { mode } })} label={t('settings.applicationMode')} />
    </Card>
  );
}

export function TracksPage() {
  const t = useT();
  const settings = useSettings();
  return (
    <>
      <PageHeader title={t('settings.tracks')} description={t('settings.tracksBody')} />
      {settings.isPending ? <LoadingState /> : null}
      {settings.isError ? <ErrorState onRetry={() => void settings.refetch()} /> : null}
      <div className="grid gap-4 md:grid-cols-2">
        {[...(settings.data?.tracks ?? [])]
          .sort((a, b) => a.position - b.position)
          .map((track) => (
            <TrackEditor key={track.id} track={track} />
          ))}
      </div>
    </>
  );
}
