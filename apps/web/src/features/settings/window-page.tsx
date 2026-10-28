'use client';

import { CheckCircle2, Clock, Zap } from 'lucide-react';
import { useSubmissionWindowForm, useT } from '@careerpilot/client-core';
import { StatusTone, SubmissionWindowKind } from '@careerpilot/domain-ui-logic';
import { Banner, Button, Card, ChoiceCards, ErrorState, LoadingState, PageHeader, TextField, cn } from '@careerpilot/ui-web';

export function WindowPage() {
  const t = useT();
  const form = useSubmissionWindowForm();
  const { settings } = form;
  const daily = form.kind === SubmissionWindowKind.DailyWindow;
  const zone = settings.data?.timeZone ?? '';

  return (
    <>
      <PageHeader title={t('settings.submissionWindow')} description={t('settings.submissionWindowBody')} />
      {settings.isPending ? <LoadingState /> : null}
      {settings.isError ? <ErrorState onRetry={() => void settings.refetch()} /> : null}
      {form.saved ? <Banner tone={StatusTone.Success} icon={CheckCircle2} title={t('common.saved')} /> : null}
      {settings.isSuccess ? (
        <Card className="max-w-3xl gap-5">
          <ChoiceCards
            label={t('settings.submissionWindow')}
            value={form.kind}
            onChange={form.chooseKind}
            options={[
              { value: SubmissionWindowKind.AsSoonAsReady, title: t('settings.asSoonAsReady'), description: t('settings.asSoonAsReadyBody'), icon: Zap },
              { value: SubmissionWindowKind.DailyWindow, title: t('settings.dailyWindow'), description: t('settings.dailyWindowBody'), icon: Clock },
            ]}
          />
          {daily ? (
            <section aria-labelledby="window-hours" className="flex flex-col gap-4 rounded-card border border-border bg-surface p-4">
              <h2 id="window-hours" className="font-semibold">
                {t('settings.windowHours')}
              </h2>
              <div className="flex flex-wrap items-center gap-2" role="group" aria-label={t('settings.windowPresetsLabel')}>
                <span className="text-sm text-muted">{t('settings.windowPresetsLabel')}</span>
                {form.presets.map((preset) => (
                  <button
                    key={preset.key}
                    type="button"
                    aria-pressed={form.activePreset === preset.key}
                    onClick={() => form.applyPreset(preset)}
                    className={cn(
                      'min-h-11 rounded-pill border px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus',
                      form.activePreset === preset.key ? 'border-primary bg-primary text-primary-foreground' : 'border-input bg-card text-foreground hover:bg-surface',
                    )}
                  >
                    {t(`settings.windowPresets.${preset.key}`)} · {preset.start}–{preset.end}
                  </button>
                ))}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <TextField label={t('settings.windowStart')} type="time" value={form.start} onChange={(e) => form.setStart(e.target.value)} error={form.errors.start} />
                <TextField label={t('settings.windowEnd')} type="time" value={form.end} onChange={(e) => form.setEnd(e.target.value)} error={form.errors.end} />
              </div>
            </section>
          ) : null}
          <p className="flex items-start gap-2 rounded-control bg-primary-subtle p-3 text-sm text-foreground">
            <Clock className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
            {daily && form.start && form.end ? t('settings.windowSummaryDaily', { start: form.start, end: form.end, zone }) : t('settings.windowSummaryNow')}
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={form.save} loading={form.saving} disabled={!form.dirty}>
              {t('common.save')}
            </Button>
            {form.dirty ? <span className="text-sm text-muted">{t('settings.unsavedChanges')}</span> : null}
          </div>
        </Card>
      ) : null}
    </>
  );
}
