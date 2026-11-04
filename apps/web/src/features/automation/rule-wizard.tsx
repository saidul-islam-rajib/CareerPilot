'use client';

import { useState } from 'react';
import type { AutomationLimits, RuleInput } from '@careerpilot/api-client';
import {
  RuleField,
  WIZARD_STEPS,
  WizardStep,
  joinList,
  parseCap,
  routeKey,
  splitList,
  toggleValue,
  trackTitle,
  useProfile,
  useSettings,
  useT,
  validateRule,
  weekdayKey,
  withValue,
  wizardStepKey,
} from '@careerpilot/client-core';
import { ApplicationRoute, SubmissionWindowKind, Weekday } from '@careerpilot/domain-ui-logic';
import { Button, Card, Checkbox, SelectField, SwitchField, TextField } from '@careerpilot/ui-web';

const DEFAULT_CV = '';

export interface RuleWizardProps {
  initial: RuleInput;
  limits: AutomationLimits;
  saving: boolean;
  failed: boolean;
  onSave: (input: RuleInput) => void;
  onCancel: () => void;
}

function numberText(value: number | undefined): string {
  return value === undefined ? '' : String(value);
}

export function RuleWizard({ initial, limits, saving, failed, onSave, onCancel }: RuleWizardProps) {
  const t = useT();
  const settings = useSettings();
  const profile = useProfile();
  const [rule, setRule] = useState<RuleInput>(initial);
  const [index, setIndex] = useState(0);
  const [attempted, setAttempted] = useState(false);
  const step = WIZARD_STEPS[index] ?? WizardStep.Scope;
  const failures = validateRule(rule, limits);
  const shown = attempted ? failures : [];
  const change = (patch: Partial<RuleInput>) => setRule((current) => ({ ...current, ...patch }));
  const changeFilters = (patch: Partial<RuleInput['filters']>) => setRule((current) => ({ ...current, filters: { ...current.filters, ...patch } }));
  const changeSchedule = (patch: Partial<RuleInput['schedule']>) => setRule((current) => ({ ...current, schedule: { ...current.schedule, ...patch } }));
  const last = index === WIZARD_STEPS.length - 1;

  const next = () => {
    if (last) {
      setAttempted(true);
      if (failures.length === 0) onSave(rule);
      return;
    }
    setIndex(index + 1);
  };

  const cap = (field: RuleField, key: 'dailyCap' | 'weeklyCap' | 'totalCap', label: string, max: number) => (
    <TextField
      label={label}
      type="number"
      min={1}
      max={max}
      value={numberText(rule.limits[key])}
      placeholder={t('automation.wizard.capNone')}
      onChange={(e) => {
        setRule((current) => ({ ...current, limits: withValue(current.limits, key, parseCap(e.target.value)) }));
      }}
      {...(shown.includes(field) ? { error: 'validation.range', errorParams: { min: 1, max } } : {})}
    />
  );

  return (
    <Card className="max-w-3xl gap-5">
      <header className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold">{t('automation.wizard.title')}</h2>
        <p className="text-sm text-muted">{t('automation.wizard.step', { current: index + 1, total: WIZARD_STEPS.length })}</p>
        <nav aria-label={t('automation.wizard.title')}>
          <ol className="flex flex-wrap gap-2 text-sm">
            {WIZARD_STEPS.map((item, position) => (
              <li key={item} aria-current={position === index ? 'step' : undefined} className={position === index ? 'font-semibold text-primary' : 'text-muted'}>
                {t(wizardStepKey(item))}
              </li>
            ))}
          </ol>
        </nav>
      </header>

      {step === WizardStep.Scope ? (
        <div className="flex flex-col gap-4">
          <TextField
            label={t('automation.wizard.name')}
            value={rule.name}
            placeholder={t('automation.wizard.namePlaceholder')}
            onChange={(e) => change({ name: e.target.value })}
            {...(shown.includes(RuleField.Name) ? { error: 'validation.required' } : {})}
          />
          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm font-medium">{t('automation.wizard.tracks')}</legend>
            <p className="text-sm text-muted">{t('automation.wizard.tracksHint')}</p>
            {(settings.data?.tracks ?? []).map((track) => (
              <Checkbox key={track.id} checked={rule.trackIds.includes(track.id)} onChange={() => change({ trackIds: toggleValue(rule.trackIds, track.id) })}>
                {trackTitle(track, t, settings.data?.homeCountry)}
              </Checkbox>
            ))}
          </fieldset>
        </div>
      ) : null}

      {step === WizardStep.Filters ? (
        <div className="flex flex-col gap-4">
          <TextField
            label={t('automation.wizard.minScore')}
            type="number"
            min={0}
            max={100}
            value={String(rule.filters.minMatchScore)}
            onChange={(e) => changeFilters({ minMatchScore: parseCap(e.target.value) ?? 0 })}
            {...(shown.includes(RuleField.MinScore) ? { error: 'validation.range', errorParams: { min: 0, max: 100 } } : {})}
          />
          <TextField
            label={t('automation.wizard.countries')}
            hint={t('automation.wizard.countriesHint')}
            value={joinList(rule.filters.countries)}
            onChange={(e) => changeFilters({ countries: splitList(e.target.value.toUpperCase()) })}
          />
          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm font-medium">{t('automation.wizard.routes')}</legend>
            <p className="text-sm text-muted">{t('automation.wizard.routesHint')}</p>
            {Object.values(ApplicationRoute).map((route) => (
              <Checkbox key={route} checked={rule.filters.allowedRoutes.includes(route)} onChange={() => changeFilters({ allowedRoutes: toggleValue(rule.filters.allowedRoutes, route) })}>
                {t(routeKey(route))}
              </Checkbox>
            ))}
          </fieldset>
          <TextField
            label={t('automation.wizard.excludedEmployers')}
            hint={t('automation.wizard.listHint')}
            value={joinList(rule.filters.excludedEmployers)}
            onChange={(e) => changeFilters({ excludedEmployers: splitList(e.target.value) })}
          />
          <TextField
            label={t('automation.wizard.excludedKeywords')}
            hint={t('automation.wizard.listHint')}
            value={joinList(rule.filters.excludedKeywords)}
            onChange={(e) => changeFilters({ excludedKeywords: splitList(e.target.value) })}
          />
          <SwitchField
            label={t('automation.wizard.allowUnknown')}
            description={t('automation.wizard.allowUnknownHint')}
            checked={rule.filters.allowUnknownRequirements}
            onChange={(checked) => changeFilters({ allowUnknownRequirements: checked })}
          />
        </div>
      ) : null}

      {step === WizardStep.Materials ? (
        <div className="flex flex-col gap-4">
          <SelectField
            label={t('automation.wizard.cv')}
            value={rule.materials.cvDocumentId ?? DEFAULT_CV}
            options={[{ value: DEFAULT_CV, label: t('automation.wizard.cvDefault') }, ...(profile.data?.documents ?? []).map((d) => ({ value: d.id, label: d.name }))]}
            onValueChange={(value) => change({ materials: value === DEFAULT_CV ? {} : { cvDocumentId: value } })}
          />
          <p className="text-sm text-muted">{t('automation.wizard.materialsNote')}</p>
        </div>
      ) : null}

      {step === WizardStep.Limits ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {cap(RuleField.DailyCap, 'dailyCap', t('automation.wizard.dailyCap'), limits.maxDailyCap)}
          {cap(RuleField.WeeklyCap, 'weeklyCap', t('automation.wizard.weeklyCap'), limits.maxWeeklyCap)}
          {cap(RuleField.TotalCap, 'totalCap', t('automation.wizard.totalCap'), limits.maxTotalCap)}
          <TextField
            label={t('automation.wizard.expiresOn')}
            hint={t('automation.wizard.expiresHint')}
            type="date"
            value={rule.limits.expiresOn ?? ''}
            onChange={(e) => setRule((current) => ({ ...current, limits: withValue(current.limits, 'expiresOn', e.target.value || undefined) }))}
            {...(shown.includes(RuleField.ExpiresOn) ? { error: 'validation.date' } : {})}
          />
        </div>
      ) : null}

      {step === WizardStep.Schedule ? (
        <div className="flex flex-col gap-4">
          <SelectField
            label={t('automation.wizard.windowKind')}
            value={rule.schedule.kind}
            options={[
              { value: SubmissionWindowKind.AsSoonAsReady, label: t('automation.wizard.windowAny') },
              { value: SubmissionWindowKind.DailyWindow, label: t('automation.wizard.windowDaily') },
            ]}
            onValueChange={(value) => changeSchedule({ kind: value as SubmissionWindowKind })}
          />
          {rule.schedule.kind === SubmissionWindowKind.DailyWindow ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <TextField
                label={t('automation.wizard.windowStart')}
                type="time"
                value={rule.schedule.start ?? ''}
                onChange={(e) => changeSchedule({ start: e.target.value })}
                {...(shown.includes(RuleField.WindowStart) ? { error: 'validation.time' } : {})}
              />
              <TextField
                label={t('automation.wizard.windowEnd')}
                type="time"
                value={rule.schedule.end ?? ''}
                onChange={(e) => changeSchedule({ end: e.target.value })}
                {...(shown.includes(RuleField.WindowEnd) ? { error: 'validation.time' } : {})}
              />
            </div>
          ) : null}
          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm font-medium">{t('automation.wizard.days')}</legend>
            <p className="text-sm text-muted">{t('automation.wizard.daysHint')}</p>
            <div className="flex flex-wrap gap-4">
              {Object.values(Weekday).map((day) => (
                <Checkbox key={day} checked={rule.schedule.days.includes(day)} onChange={() => changeSchedule({ days: toggleValue(rule.schedule.days, day) })}>
                  {t(weekdayKey(day))}
                </Checkbox>
              ))}
            </div>
          </fieldset>
        </div>
      ) : null}

      {step === WizardStep.Review ? (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-muted">{t('automation.wizard.reviewIntro')}</p>
          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            <dt className="text-muted">{t('automation.wizard.name')}</dt>
            <dd>{rule.name || t('automation.wizard.reviewNone')}</dd>
            <dt className="text-muted">{t('automation.wizard.minScore')}</dt>
            <dd>{rule.filters.minMatchScore}%</dd>
            <dt className="text-muted">{t('automation.wizard.tracks')}</dt>
            <dd>{rule.trackIds.length > 0 ? rule.trackIds.length : t('automation.allTracks')}</dd>
            <dt className="text-muted">{t('automation.wizard.dailyCap')}</dt>
            <dd>{rule.limits.dailyCap ?? t('automation.wizard.capNone')}</dd>
            <dt className="text-muted">{t('automation.wizard.weeklyCap')}</dt>
            <dd>{rule.limits.weeklyCap ?? t('automation.wizard.capNone')}</dd>
          </dl>
          <SwitchField label={t('automation.wizard.enabled')} checked={rule.enabled} onChange={(checked) => change({ enabled: checked })} />
          {attempted && failures.length > 0 ? <p role="alert" className="text-sm text-danger">{t('automation.errors.save')}</p> : null}
          {failed ? <p role="alert" className="text-sm text-danger">{t('automation.errors.save')}</p> : null}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <Button variant="outline" onClick={index === 0 ? onCancel : () => setIndex(index - 1)}>
          {index === 0 ? t('automation.wizard.cancel') : t('automation.wizard.back')}
        </Button>
        <Button onClick={next} loading={saving}>
          {last ? t('automation.wizard.save') : t('automation.wizard.next')}
        </Button>
      </div>
    </Card>
  );
}
