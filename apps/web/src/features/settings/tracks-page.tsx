'use client';

import type { Track } from '@careerpilot/api-client';
import { trackTitle, useEnumDisplay, useSettings, useT, useTrackEditor } from '@careerpilot/client-core';
import { ApplicationMode, EnumKey, enumValues } from '@careerpilot/domain-ui-logic';
import { Card, CardTitle, ErrorState, LoadingState, PageHeader, Segmented, Stepper } from '@careerpilot/ui-web';

function TrackEditor({ track }: { track: Track }) {
  const t = useT();
  const display = useEnumDisplay();
  const editor = useTrackEditor(track);
  const modes = enumValues(ApplicationMode).map((mode) => ({ value: mode, label: display(EnumKey.ApplicationMode, mode).label }));
  return (
    <Card className="gap-3">
      <div className="flex items-center justify-between gap-2">
        <CardTitle className="text-lg">{trackTitle(track, t)}</CardTitle>
        {editor.saving ? <span className="text-xs text-muted">{t('common.saving')}</span> : null}
      </div>
      <p className="text-sm text-muted">{t('settings.resultCount')}</p>
      <Stepper name={t('settings.resultCount')} value={editor.count} min={editor.min} max={editor.max} onChange={editor.changeCount} />
      <p className="text-sm text-muted">{t('settings.applicationMode')}</p>
      <Segmented options={modes} value={editor.mode} onChange={editor.changeMode} label={t('settings.applicationMode')} />
      {editor.failed ? <p role="alert" className="text-sm text-danger">{t('settings.trackSaveFailed')}</p> : null}
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
