'use client';

import Link from 'next/link';
import { AlertCircle, AlertTriangle, CalendarClock, CheckCircle2, Mail, Send, Sparkles, type LucideIcon } from 'lucide-react';
import { useFormat, useNotificationsForm, usePublicConfig, useServices, useT } from '@careerpilot/client-core';
import type { DigestTimePreset } from '@careerpilot/api-client';
import { StatusTone } from '@careerpilot/domain-ui-logic';
import { Banner, Button, Card, ErrorState, LoadingState, PageHeader, SwitchField, TextField, cn, useToast } from '@careerpilot/ui-web';
import { sectionAnchor } from '@/features/profile/profile-support';
import { Routes } from '@/core/routes';

const PREVIEW_SECTIONS: ReadonlyArray<{ key: string; icon: LucideIcon }> = [
  { key: 'matches', icon: Sparkles },
  { key: 'approvals', icon: CheckCircle2 },
  { key: 'sent', icon: Send },
  { key: 'attention', icon: AlertTriangle },
  { key: 'closing', icon: CalendarClock },
];

function IconBadge({ icon: Icon }: { icon: LucideIcon }) {
  return (
    <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-subtle text-primary">
      <Icon className="size-5" aria-hidden />
    </span>
  );
}

function PresetChoices({ presets, value, onSelect }: { presets: DigestTimePreset[]; value: string; onSelect: (time: string) => void }) {
  const t = useT();
  const format = useFormat();
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
      {presets.map((preset) => {
        const selected = preset.time === value;
        return (
          <button
            key={preset.key}
            type="button"
            aria-pressed={selected}
            onClick={() => onSelect(preset.time)}
            className={cn(
              'flex min-h-11 items-center justify-between gap-2 rounded-control border px-3 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus sm:flex-col sm:items-start sm:justify-start',
              selected ? 'border-primary bg-primary-subtle text-primary' : 'border-border bg-background text-foreground hover:bg-neutral-subtle',
            )}
          >
            <span className="text-sm font-semibold">{t(`settings.digestPresets.${preset.key}`)}</span>
            <span className={cn('text-sm tabular-nums', selected ? 'text-primary' : 'text-muted')}>{format.time(preset.time)}</span>
          </button>
        );
      })}
    </div>
  );
}

function DigestPreview({ enabled, time }: { enabled: boolean; time: string }) {
  const t = useT();
  const format = useFormat();
  const { clock } = useServices();
  const { config } = usePublicConfig();
  return (
    <Card className={cn('gap-4 p-5 transition-opacity lg:sticky lg:top-6', !enabled && 'opacity-60')} aria-labelledby="digest-preview-title">
      <div className="flex flex-col gap-1">
        <h2 id="digest-preview-title" className="font-semibold text-foreground">
          {t('settings.digestPreviewTitle')}
        </h2>
        <p className="text-sm text-muted">{enabled ? t('settings.digestPreviewWhen', { time: format.time(time) }) : t('settings.digestPreviewOff')}</p>
      </div>
      <div className="flex flex-col gap-3 rounded-control border border-border bg-surface p-4">
        <div className="flex items-center gap-2 border-b border-border pb-3">
          <Mail className="size-4 shrink-0 text-muted" aria-hidden />
          <div className="min-w-0">
            <p className="text-xs text-muted">{config.branding.productName}</p>
            <p className="text-sm font-semibold text-foreground">{t('digest.subject', { date: format.date(clock.now().toISOString()) })}</p>
          </div>
        </div>
        <ul className="flex flex-col gap-3">
          {PREVIEW_SECTIONS.map(({ key, icon: Icon }) => (
            <li key={key} className="flex gap-3">
              <Icon className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">{t(`settings.digestPreviewSections.${key}.title`)}</p>
                <p className="text-xs text-muted">{t(`settings.digestPreviewSections.${key}.body`)}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
      <p className="text-xs text-muted">{t('settings.digestPreviewQuiet')}</p>
    </Card>
  );
}

export function NotificationsPage() {
  const t = useT();
  const toast = useToast();
  const form = useNotificationsForm({ onSaved: () => toast.show({ message: t('common.saved') }) });
  const { settings, values } = form;
  return (
    <>
      <PageHeader title={t('settings.notifications')} description={t('settings.notificationsBody')} />
      {settings.isPending ? <LoadingState /> : null}
      {settings.isError ? <ErrorState onRetry={() => void settings.refetch()} /> : null}
      {form.formError ? <Banner tone={StatusTone.Danger} icon={AlertCircle} title={t(form.formError)} /> : null}
      {settings.isSuccess ? (
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
          <Card className="gap-0 p-0">
            <form
              noValidate
              onSubmit={(e) => {
                e.preventDefault();
                form.submit();
              }}
            >
              <div className="flex items-start gap-4 p-5">
                <IconBadge icon={Mail} />
                <SwitchField className="min-w-0 flex-1" checked={values.digestEnabled} onChange={form.setDigestEnabled} label={t('settings.digestEnabled')} description={t('settings.digestBody')} />
              </div>
              {values.digestEnabled ? (
                <div className="flex flex-col gap-6 border-t border-border p-5">
                  <fieldset className="flex min-w-0 flex-col gap-3">
                    <legend className="mb-3 text-sm font-semibold text-foreground">{t('settings.digestTime')}</legend>
                    <PresetChoices presets={form.presets} value={values.digestTime} onSelect={form.setDigestTime} />
                    <div className="sm:max-w-56">
                      <TextField
                        type="time"
                        label={t('settings.digestCustomTime')}
                        value={values.digestTime}
                        onChange={(e) => form.setDigestTime(e.target.value)}
                        error={form.errors.digestTime}
                      />
                    </div>
                    <p className="text-xs text-muted">{t('settings.digestTimeZone', { timeZone: form.timeZone })}</p>
                  </fieldset>
                  {form.recipient ? (
                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-control bg-neutral-subtle px-4 py-3">
                      <div className="min-w-0">
                        <p className="text-xs text-muted">{t('settings.digestSentTo')}</p>
                        <p className="break-all text-sm font-medium text-foreground">{form.recipient}</p>
                      </div>
                      <Link href={`${Routes.profile}#${sectionAnchor('contacts')}`} className="text-sm font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus">
                        {t('settings.digestChangeEmail')}
                      </Link>
                    </div>
                  ) : null}
                </div>
              ) : (
                <p className="border-t border-border p-5 text-sm text-muted">{t('settings.digestOffNote')}</p>
              )}
              <div className="flex flex-col-reverse items-stretch gap-3 border-t border-border p-4 sm:flex-row sm:items-center sm:justify-end">
                {form.dirty ? (
                  <p className="text-sm text-muted sm:mr-auto" role="status">
                    {t('settings.unsavedChanges')}
                  </p>
                ) : null}
                <Button type="submit" loading={form.saving} disabled={!form.dirty}>
                  {t('common.save')}
                </Button>
              </div>
            </form>
          </Card>
          <DigestPreview enabled={values.digestEnabled} time={values.digestTime} />
        </div>
      ) : null}
    </>
  );
}
