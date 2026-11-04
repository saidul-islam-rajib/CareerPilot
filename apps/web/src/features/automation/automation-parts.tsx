'use client';

import { useState } from 'react';
import type { AutomationLimits, AutomationOverview, AutomationSettingsInput, DryRunItem, DryRunResult, SkippedRecord } from '@careerpilot/api-client';
import {
  DEADLINE_ACTIONS,
  actionKey,
  holdKey,
  outcomeKey,
  parseCap,
  skipReasonKey,
  useFormat,
  useT,
  userOnlyKey,
  validateSettings,
} from '@careerpilot/client-core';
import { DryRunOutcome, SkipReason, StatusTone, type DeadlineAction } from '@careerpilot/domain-ui-logic';
import { Badge, Button, Card, SelectField, TextField } from '@careerpilot/ui-web';

const OUTCOME_TONES: Record<DryRunOutcome, StatusTone> = {
  [DryRunOutcome.WouldApply]: StatusTone.Success,
  [DryRunOutcome.Deferred]: StatusTone.Warning,
  [DryRunOutcome.Skipped]: StatusTone.Neutral,
};

export function StatusCard({ overview }: { overview: AutomationOverview }) {
  const t = useT();
  const held = overview.holds.length > 0;
  return (
    <Card className="gap-3">
      <h2 className="font-semibold">{t('automation.statusTitle')}</h2>
      <p className="text-sm text-muted">{held ? t('automation.statusHeld') : t('automation.statusRunning')}</p>
      {held ? (
        <ul className="flex flex-wrap gap-2">
          {overview.holds.map((hold) => (
            <li key={hold}>
              <Badge label={t(skipReasonKey(hold))} tone={StatusTone.Warning} />
            </li>
          ))}
        </ul>
      ) : null}
      <dl className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-muted">{t('automation.today')}</dt>
          <dd className="text-lg font-semibold">{overview.submittedToday}</dd>
        </div>
        <div>
          <dt className="text-muted">{t('automation.thisWeek')}</dt>
          <dd className="text-lg font-semibold">{overview.submittedThisWeek}</dd>
        </div>
      </dl>
      <p className="text-sm text-muted">{t('automation.capsLine', { daily: overview.settings.dailyCap, weekly: overview.settings.weeklyCap })}</p>
    </Card>
  );
}

interface SettingsCardProps {
  overview: AutomationOverview;
  saving: boolean;
  saved: boolean;
  onSave: (input: AutomationSettingsInput) => void;
}

export function SettingsCard({ overview, saving, saved, onSave }: SettingsCardProps) {
  const t = useT();
  const { settings, limits } = overview;
  const [buffer, setBuffer] = useState(String(settings.deadlineBufferHours));
  const [action, setAction] = useState<DeadlineAction>(settings.deadlineAction);
  const [weekly, setWeekly] = useState(String(settings.weeklyCap));
  const [inactivity, setInactivity] = useState(String(settings.inactivityDays));
  const [attempted, setAttempted] = useState(false);
  const input: AutomationSettingsInput = {
    deadlineAction: action,
    ...(parseCap(buffer) !== undefined ? { deadlineBufferHours: parseCap(buffer) as number } : {}),
    ...(parseCap(weekly) !== undefined ? { weeklyCap: parseCap(weekly) as number } : {}),
    ...(parseCap(inactivity) !== undefined ? { inactivityDays: parseCap(inactivity) as number } : {}),
  };
  const valid = validateSettings(input, limits);
  const rangeError = (low: number, high: number) => (attempted && !valid ? { error: 'validation.range', errorParams: { min: low, max: high } } : {});
  return (
    <Card className="gap-4">
      <h2 className="font-semibold">{t('automation.settingsTitle')}</h2>
      <TextField label={t('automation.deadlineBuffer')} hint={t('automation.deadlineBufferHint')} type="number" min={0} value={buffer} onChange={(e) => setBuffer(e.target.value)} {...rangeError(0, limits.maxDeadlineBufferHours)} />
      <SelectField
        label={t('automation.deadlineAction')}
        value={action}
        options={DEADLINE_ACTIONS.map((value) => ({ value, label: t(actionKey(value)) }))}
        onValueChange={(value) => setAction(value as DeadlineAction)}
      />
      <TextField label={t('automation.weeklyCap')} type="number" min={1} value={weekly} onChange={(e) => setWeekly(e.target.value)} {...rangeError(1, limits.maxWeeklyCap)} />
      <TextField label={t('automation.inactivity')} hint={t('automation.inactivityHint')} type="number" value={inactivity} onChange={(e) => setInactivity(e.target.value)} {...rangeError(limits.minInactivityDays, limits.maxInactivityDays)} />
      <div className="flex flex-wrap items-center gap-3">
        <Button
          loading={saving}
          onClick={() => {
            setAttempted(true);
            if (valid) onSave(input);
          }}
        >
          {t('automation.saveSettings')}
        </Button>
        {saved ? <span role="status" className="text-sm text-muted">{t('automation.saved')}</span> : null}
      </div>
    </Card>
  );
}

function ReasonList({ reasons }: { reasons: SkipReason[] }) {
  const t = useT();
  return reasons.length > 0 ? (
    <ul className="flex flex-col gap-1 text-sm text-muted">
      {reasons.map((reason) => (
        <li key={reason}>{t(skipReasonKey(reason))}</li>
      ))}
    </ul>
  ) : null;
}

function DryRunRow({ item }: { item: DryRunItem }) {
  const t = useT();
  const format = useFormat();
  return (
    <li className="flex flex-col gap-2 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-semibold">{item.title}</p>
          <p className="text-sm text-muted">
            {item.organization} · {t('automation.dryRun.match', { score: item.matchScore })}
          </p>
        </div>
        <Badge label={t(outcomeKey(item.outcome))} tone={OUTCOME_TONES[item.outcome]} />
      </div>
      <p className="text-sm text-muted">{item.ruleName ? t('automation.dryRun.rule', { name: item.ruleName }) : t('automation.dryRun.noRule')}</p>
      <ReasonList reasons={item.reasons} />
      {item.earliestAt ? <p className="text-sm">{t('automation.dryRun.earliest', { at: format.dateTime(item.earliestAt) })}</p> : null}
      {item.bypassesWindow ? <p className="text-sm">{t('automation.dryRun.bypass')}</p> : null}
      {item.materials ? (
        <details className="rounded-control border border-border bg-surface p-3 text-sm">
          <summary className="cursor-pointer font-medium">{t('automation.dryRun.materials')}</summary>
          <p className="mt-2">{t('automation.dryRun.cv', { name: item.materials.cvName, version: item.materials.cvVersion })}</p>
          <p className="mt-2 font-medium">{t('automation.dryRun.coverLetter')}</p>
          <p className="whitespace-pre-wrap text-muted">{item.materials.coverLetter}</p>
        </details>
      ) : null}
    </li>
  );
}

export function DryRunPanel({ result, onClose }: { result: DryRunResult; onClose: () => void }) {
  const t = useT();
  return (
    <Card className="gap-3" role="region" aria-label={t('automation.dryRun.title')}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">{t('automation.dryRun.title')}</h2>
        <Button variant="outline" onClick={onClose}>
          {t('automation.dryRun.close')}
        </Button>
      </div>
      <p className="text-sm text-muted">{t('automation.dryRun.safe')}</p>
      <p className="font-medium">{t('automation.dryRun.summary', { apply: result.wouldApply, deferred: result.deferred, skipped: result.skipped })}</p>
      {result.holds.length > 0 ? (
        <p className="text-sm">
          {t('automation.dryRun.heldBy')}: {result.holds.map((hold) => t(skipReasonKey(hold))).join(', ')}
        </p>
      ) : null}
      {result.items.length === 0 ? (
        <p className="text-sm text-muted">{t('automation.dryRun.empty')}</p>
      ) : (
        <ul className="divide-y divide-border">
          {result.items.map((item) => (
            <DryRunRow key={item.opportunityId} item={item} />
          ))}
        </ul>
      )}
    </Card>
  );
}

export function SkippedCard({ records }: { records: SkippedRecord[] }) {
  const t = useT();
  return (
    <Card className="gap-3">
      <h2 className="font-semibold">{t('automation.skippedTitle')}</h2>
      {records.length === 0 ? (
        <p className="text-sm text-muted">{t('automation.skippedEmpty')}</p>
      ) : (
        <ul className="divide-y divide-border">
          {records.map((record) => (
            <li key={record.opportunityId} className="flex flex-col gap-1 py-2">
              <p className="font-medium">
                {record.title} · <span className="text-muted">{record.organization}</span>
              </p>
              <ReasonList reasons={record.reasons} />
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export function UserOnlyCard({ steps }: { steps: string[] }) {
  const t = useT();
  return (
    <Card className="gap-3">
      <h2 className="font-semibold">{t('automation.userOnlyTitle')}</h2>
      <p className="text-sm text-muted">{t('automation.userOnlyBody')}</p>
      <ul className="list-disc pl-5 text-sm">
        {steps.map((step) => (
          <li key={step}>{t(userOnlyKey(step))}</li>
        ))}
      </ul>
    </Card>
  );
}

export function holdLabel(hold: string, t: (key: string) => string): string {
  return t(holdKey(hold));
}

export type { AutomationLimits };
