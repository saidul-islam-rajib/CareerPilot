'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, OctagonX, PlayCircle } from 'lucide-react';
import type { PlatformSettings, PlatformSettingsUpdate } from '@careerpilot/api-client';
import { useFormat, usePublicConfig, useT } from '@careerpilot/client-core';
import { AdminArea, EmergencyStopScope, PermissionAction, StatusTone } from '@careerpilot/domain-ui-logic';
import { THEME_KEYS, themes, type ThemeKey } from '@careerpilot/ui-tokens';
import { ValidationMessage } from '@careerpilot/validation';
import { Badge, Banner, BrandMark, Button, Card, ConfirmDialog, ErrorState, LoadingState, PageHeader, Section, TextField, ThemeScope, cn } from '@careerpilot/ui-web';
import { adminKeys, useAdminMutation } from '@/core/admin-queries';
import { useAdminApi } from '@/core/admin-services';
import { useCan } from '@/core/admin-session';

function ThemePreview({ themeKey }: { themeKey: ThemeKey }) {
  const t = useT();
  const { config } = usePublicConfig();
  return (
    <ThemeScope theme={themes[themeKey]} className="flex flex-col gap-3 rounded-card border border-border bg-surface p-4">
      <div className="flex items-center gap-2">
        <BrandMark className="size-8" />
        <span className="font-bold text-foreground">{t('app.name')}</span>
      </div>
      <div className="flex flex-col gap-2 rounded-card border border-border bg-card p-3">
        <span className="text-sm font-semibold text-foreground">{t('home.newMatches')}</span>
        <div className="flex flex-wrap gap-2">
          <Badge label={t('opportunity.match', { score: config.display.strongMatchScore })} tone={StatusTone.Success} />
          <Badge label={t('enums.work_arrangement.remote')} tone={StatusTone.Primary} />
          <Badge label={t('enums.submission_status.awaiting_approval')} tone={StatusTone.Warning} />
        </div>
      </div>
      <Button size="sm">{t('approvals.approveAndSend')}</Button>
    </ThemeScope>
  );
}

function LimitsForm({ settings }: { settings: PlatformSettings }) {
  const t = useT();
  const api = useAdminApi();
  const { config } = usePublicConfig();
  const canUpdate = useCan(AdminArea.Settings, PermissionAction.Update);
  const save = useAdminMutation((update: PlatformSettingsUpdate) => api.settings.updateSettings(update));
  const [values, setValues] = useState({ dailyApplicationCap: '', approvalValidityDays: '', deletionGraceDays: '', accountLinkTtlMinutes: '' });
  const [linkTtlError, setLinkTtlError] = useState<string>();
  const linkBounds = { min: config.accountLinks.minTtlMinutes, max: config.accountLinks.maxTtlMinutes };

  useEffect(() => {
    setValues({
      dailyApplicationCap: String(settings.dailyApplicationCap),
      approvalValidityDays: String(settings.approvalValidityDays),
      deletionGraceDays: String(settings.deletionGraceDays),
      accountLinkTtlMinutes: String(settings.accountLinkTtlMinutes),
    });
  }, [settings.accountLinkTtlMinutes, settings.approvalValidityDays, settings.dailyApplicationCap, settings.deletionGraceDays]);

  const setValue = (key: keyof typeof values, value: string) => {
    setValues((v) => ({ ...v, [key]: value }));
    if (key === 'accountLinkTtlMinutes') {
      setLinkTtlError(undefined);
    }
  };

  const field = (key: keyof typeof values, label: string) => (
    <TextField label={label} type="number" min={1} inputMode="numeric" value={values[key]} disabled={!canUpdate} onChange={(e) => setValue(key, e.target.value)} />
  );

  const submit = () => {
    const linkTtl = Number(values.accountLinkTtlMinutes);
    if (!Number.isInteger(linkTtl) || linkTtl < linkBounds.min || linkTtl > linkBounds.max) {
      setLinkTtlError(ValidationMessage.Range);
      return;
    }
    save.mutate({
      dailyApplicationCap: Number(values.dailyApplicationCap),
      approvalValidityDays: Number(values.approvalValidityDays),
      deletionGraceDays: Number(values.deletionGraceDays),
      accountLinkTtlMinutes: linkTtl,
    });
  };

  return (
    <Card className="gap-4">
      {save.isSuccess ? <Banner tone={StatusTone.Success} icon={CheckCircle2} title={t('common.saved')} /> : null}
      <div className="grid gap-4 md:grid-cols-2">
        {field('dailyApplicationCap', t('admin.settings.dailyCap'))}
        {field('approvalValidityDays', t('admin.settings.approvalValidity'))}
        {field('deletionGraceDays', t('admin.settings.deletionGrace'))}
        <TextField
          label={t('admin.settings.linkTtl')}
          type="number"
          min={linkBounds.min}
          max={linkBounds.max}
          step={1}
          inputMode="numeric"
          value={values.accountLinkTtlMinutes}
          disabled={!canUpdate}
          onChange={(e) => setValue('accountLinkTtlMinutes', e.target.value)}
          hint={t('admin.settings.linkTtlHint', linkBounds)}
          error={linkTtlError}
          errorParams={linkBounds}
        />
      </div>
      {canUpdate ? (
        <Button className="self-start" loading={save.isPending} onClick={submit}>
          {t('common.save')}
        </Button>
      ) : null}
    </Card>
  );
}

export function SettingsPage() {
  const t = useT();
  const api = useAdminApi();
  const format = useFormat();
  const canUpdate = useCan(AdminArea.Settings, PermissionAction.Update);
  const settings = useQuery({ queryKey: adminKeys.settings, queryFn: () => api.settings.getSettings() });
  const [preview, setPreview] = useState<ThemeKey>();
  const [reason, setReason] = useState('');
  const applyTheme = useAdminMutation((activeTheme: ThemeKey) => api.settings.updateSettings({ activeTheme }));
  const startStop = useAdminMutation((stopReason: string) => api.settings.startEmergencyStop({ scope: EmergencyStopScope.AllUsers, reason: stopReason }));
  const endStop = useAdminMutation(() => api.settings.endEmergencyStop());

  if (settings.isPending) {
    return <LoadingState />;
  }
  if (settings.isError) {
    return <ErrorState onRetry={() => void settings.refetch()} />;
  }
  const s = settings.data;
  const selected = preview ?? s.activeTheme;
  const themeName = (key: ThemeKey) => t(`themes.${key}`);

  return (
    <>
      <PageHeader title={t('admin.settings.title')} />

      <Section title={t('admin.settings.theme')}>
        <p className="text-sm text-muted">{t('admin.settings.themeBody')}</p>
        {applyTheme.isSuccess ? <Banner tone={StatusTone.Success} icon={CheckCircle2} title={t('admin.settings.themeApplied', { theme: themeName(s.activeTheme) })} /> : null}
        <div className="grid gap-4 md:grid-cols-3" role="radiogroup" aria-label={t('admin.settings.theme')}>
          {THEME_KEYS.map((key) => (
            <button
              key={key}
              type="button"
              role="radio"
              aria-checked={selected === key}
              onClick={() => setPreview(key)}
              className={cn('flex flex-col gap-3 rounded-card border-2 bg-card p-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus', selected === key ? 'border-primary' : 'border-border')}
            >
              <span className="flex items-center justify-between gap-2">
                <span className="font-semibold">{themeName(key)}</span>
                {s.activeTheme === key ? <Badge label={t('admin.settings.current')} tone={StatusTone.Primary} /> : null}
              </span>
              <ThemePreview themeKey={key} />
            </button>
          ))}
        </div>
        {canUpdate ? (
          <Button className="self-start" disabled={selected === s.activeTheme} loading={applyTheme.isPending} onClick={() => applyTheme.mutate(selected)}>
            {t('admin.settings.applyTheme', { theme: themeName(selected) })}
          </Button>
        ) : null}
      </Section>

      <Section title={t('admin.settings.limits')}>
        <LimitsForm settings={s} />
      </Section>

      <Section title={t('admin.settings.emergency')}>
        <Card className="gap-4">
          <p className="text-sm text-muted">{t('admin.settings.emergencyBody')}</p>
          {s.emergencyStop.active ? (
            <>
              <Banner
                tone={StatusTone.Danger}
                icon={OctagonX}
                title={t('admin.settings.stopActive', { date: s.emergencyStop.since ? format.dateTime(s.emergencyStop.since) : '', reason: s.emergencyStop.reason ?? '' })}
              />
              {canUpdate ? (
                <Button className="self-start" variant="outline" icon={PlayCircle} loading={endStop.isPending} onClick={() => endStop.mutate(undefined)}>
                  {t('admin.settings.endStop')}
                </Button>
              ) : null}
            </>
          ) : canUpdate ? (
            <>
              <TextField label={t('admin.settings.emergencyReason')} value={reason} onChange={(e) => setReason(e.target.value)} />
              <ConfirmDialog
                title={t('admin.settings.confirmStop')}
                body={t('admin.settings.confirmStopBody')}
                confirmLabel={t('admin.settings.startStop')}
                destructive
                onConfirm={() => startStop.mutate(reason.trim())}
                trigger={
                  <Button className="self-start" variant="destructive" icon={OctagonX} disabled={reason.trim().length === 0} loading={startStop.isPending}>
                    {t('admin.settings.startStop')}
                  </Button>
                }
              />
            </>
          ) : null}
        </Card>
      </Section>
    </>
  );
}
