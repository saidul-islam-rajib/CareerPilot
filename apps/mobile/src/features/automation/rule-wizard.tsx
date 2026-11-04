import { useState } from 'react';
import { View } from 'react-native';
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
import { useTheme } from '@/core/theme/theme';
import { Button, ButtonVariant, Card, Checkbox, SelectField, SwitchRow, Text, TextField, TextTone, TextVariant } from '@/ui';

const DEFAULT_CV = '';

export interface RuleWizardProps {
  initial: RuleInput;
  limits: AutomationLimits;
  saving: boolean;
  failed: boolean;
  onSave: (input: RuleInput) => void;
  onCancel: () => void;
}

type CapKey = 'dailyCap' | 'weeklyCap' | 'totalCap';

function numberText(value: number | undefined): string {
  return value === undefined ? '' : String(value);
}

export function RuleWizard({ initial, limits, saving, failed, onSave, onCancel }: RuleWizardProps) {
  const t = useT();
  const theme = useTheme();
  const settings = useSettings();
  const profile = useProfile();
  const [rule, setRule] = useState<RuleInput>(initial);
  const [index, setIndex] = useState(0);
  const [attempted, setAttempted] = useState(false);
  const step = WIZARD_STEPS[index] ?? WizardStep.Scope;
  const failures = validateRule(rule, limits);
  const shown = attempted ? failures : [];
  const last = index === WIZARD_STEPS.length - 1;
  const change = (patch: Partial<RuleInput>) => setRule((current) => ({ ...current, ...patch }));
  const changeFilters = (patch: Partial<RuleInput['filters']>) => setRule((current) => ({ ...current, filters: { ...current.filters, ...patch } }));
  const changeSchedule = (patch: Partial<RuleInput['schedule']>) => setRule((current) => ({ ...current, schedule: { ...current.schedule, ...patch } }));

  const next = () => {
    if (!last) {
      setIndex(index + 1);
      return;
    }
    setAttempted(true);
    if (failures.length === 0) onSave(rule);
  };

  const cap = (field: RuleField, key: CapKey, label: string, max: number) => (
    <TextField
      label={label}
      value={numberText(rule.limits[key])}
      placeholder={t('automation.wizard.capNone')}
      keyboardType="number-pad"
      onChangeText={(text) => setRule((current) => ({ ...current, limits: withValue(current.limits, key, parseCap(text)) }))}
      testID={`rule-${key}`}
      {...(shown.includes(field) ? { error: 'validation.range', errorParams: { min: 1, max } } : {})}
    />
  );

  return (
    <View style={{ gap: theme.space.md }}>
      <Card>
        <Text variant={TextVariant.Heading}>{t('automation.wizard.title')}</Text>
        <Text tone={TextTone.Muted}>{t('automation.wizard.step', { current: index + 1, total: WIZARD_STEPS.length })}</Text>
        <Text variant={TextVariant.Subheading}>{t(wizardStepKey(step))}</Text>
      </Card>

      {step === WizardStep.Scope ? (
        <Card>
          <TextField
            label={t('automation.wizard.name')}
            value={rule.name}
            placeholder={t('automation.wizard.namePlaceholder')}
            onChangeText={(name) => change({ name })}
            testID="rule-name"
            {...(shown.includes(RuleField.Name) ? { error: 'validation.required' } : {})}
          />
          <Text variant={TextVariant.Label}>{t('automation.wizard.tracks')}</Text>
          <Text tone={TextTone.Muted}>{t('automation.wizard.tracksHint')}</Text>
          {(settings.data?.tracks ?? []).map((track) => {
            const title = trackTitle(track, t, settings.data?.homeCountry);
            return (
              <Checkbox key={track.id} accessibilityLabel={title} checked={rule.trackIds.includes(track.id)} onChange={() => change({ trackIds: toggleValue(rule.trackIds, track.id) })}>
                <Text>{title}</Text>
              </Checkbox>
            );
          })}
        </Card>
      ) : null}

      {step === WizardStep.Filters ? (
        <Card>
          <TextField
            label={t('automation.wizard.minScore')}
            value={String(rule.filters.minMatchScore)}
            keyboardType="number-pad"
            onChangeText={(text) => changeFilters({ minMatchScore: parseCap(text) ?? 0 })}
            testID="rule-min-score"
            {...(shown.includes(RuleField.MinScore) ? { error: 'validation.range', errorParams: { min: 0, max: 100 } } : {})}
          />
          <TextField
            label={t('automation.wizard.countries')}
            hint={t('automation.wizard.countriesHint')}
            value={joinList(rule.filters.countries)}
            autoCapitalize="characters"
            onChangeText={(text) => changeFilters({ countries: splitList(text.toUpperCase()) })}
          />
          <Text variant={TextVariant.Label}>{t('automation.wizard.routes')}</Text>
          <Text tone={TextTone.Muted}>{t('automation.wizard.routesHint')}</Text>
          {Object.values(ApplicationRoute).map((route) => (
            <Checkbox key={route} accessibilityLabel={t(routeKey(route))} checked={rule.filters.allowedRoutes.includes(route)} onChange={() => changeFilters({ allowedRoutes: toggleValue(rule.filters.allowedRoutes, route) })}>
              <Text>{t(routeKey(route))}</Text>
            </Checkbox>
          ))}
          <TextField
            label={t('automation.wizard.excludedEmployers')}
            hint={t('automation.wizard.listHint')}
            value={joinList(rule.filters.excludedEmployers)}
            onChangeText={(text) => changeFilters({ excludedEmployers: splitList(text) })}
          />
          <TextField
            label={t('automation.wizard.excludedKeywords')}
            hint={t('automation.wizard.listHint')}
            value={joinList(rule.filters.excludedKeywords)}
            onChangeText={(text) => changeFilters({ excludedKeywords: splitList(text) })}
          />
          <SwitchRow
            label={t('automation.wizard.allowUnknown')}
            description={t('automation.wizard.allowUnknownHint')}
            value={rule.filters.allowUnknownRequirements}
            onChange={(value) => changeFilters({ allowUnknownRequirements: value })}
          />
        </Card>
      ) : null}

      {step === WizardStep.Materials ? (
        <Card>
          <SelectField
            label={t('automation.wizard.cv')}
            placeholder={t('automation.wizard.cvDefault')}
            value={rule.materials.cvDocumentId ?? DEFAULT_CV}
            options={[{ value: DEFAULT_CV, label: t('automation.wizard.cvDefault') }, ...(profile.data?.documents ?? []).map((d) => ({ value: d.id, label: d.name }))]}
            onChange={(value) => change({ materials: value === DEFAULT_CV ? {} : { cvDocumentId: value } })}
          />
          <Text tone={TextTone.Muted}>{t('automation.wizard.materialsNote')}</Text>
        </Card>
      ) : null}

      {step === WizardStep.Limits ? (
        <Card>
          {cap(RuleField.DailyCap, 'dailyCap', t('automation.wizard.dailyCap'), limits.maxDailyCap)}
          {cap(RuleField.WeeklyCap, 'weeklyCap', t('automation.wizard.weeklyCap'), limits.maxWeeklyCap)}
          {cap(RuleField.TotalCap, 'totalCap', t('automation.wizard.totalCap'), limits.maxTotalCap)}
          <TextField
            label={t('automation.wizard.expiresOn')}
            hint={t('automation.wizard.expiresHint')}
            value={rule.limits.expiresOn ?? ''}
            onChangeText={(text) => setRule((current) => ({ ...current, limits: withValue(current.limits, 'expiresOn', text || undefined) }))}
            testID="rule-expires"
            {...(shown.includes(RuleField.ExpiresOn) ? { error: 'validation.date' } : {})}
          />
        </Card>
      ) : null}

      {step === WizardStep.Schedule ? (
        <Card>
          <SelectField
            label={t('automation.wizard.windowKind')}
            placeholder={t('automation.wizard.windowAny')}
            value={rule.schedule.kind}
            options={[
              { value: SubmissionWindowKind.AsSoonAsReady, label: t('automation.wizard.windowAny') },
              { value: SubmissionWindowKind.DailyWindow, label: t('automation.wizard.windowDaily') },
            ]}
            onChange={(value) => changeSchedule({ kind: value as SubmissionWindowKind })}
          />
          {rule.schedule.kind === SubmissionWindowKind.DailyWindow ? (
            <>
              <TextField
                label={t('automation.wizard.windowStart')}
                value={rule.schedule.start ?? ''}
                placeholder={t('settings.timePlaceholder')}
                keyboardType="numbers-and-punctuation"
                onChangeText={(start) => changeSchedule({ start })}
                testID="rule-start"
                {...(shown.includes(RuleField.WindowStart) ? { error: 'validation.time' } : {})}
              />
              <TextField
                label={t('automation.wizard.windowEnd')}
                value={rule.schedule.end ?? ''}
                placeholder={t('settings.timePlaceholder')}
                keyboardType="numbers-and-punctuation"
                onChangeText={(end) => changeSchedule({ end })}
                testID="rule-end"
                {...(shown.includes(RuleField.WindowEnd) ? { error: 'validation.time' } : {})}
              />
            </>
          ) : null}
          <Text variant={TextVariant.Label}>{t('automation.wizard.days')}</Text>
          <Text tone={TextTone.Muted}>{t('automation.wizard.daysHint')}</Text>
          {Object.values(Weekday).map((day) => (
            <Checkbox key={day} accessibilityLabel={t(weekdayKey(day))} checked={rule.schedule.days.includes(day)} onChange={() => changeSchedule({ days: toggleValue(rule.schedule.days, day) })}>
              <Text>{t(weekdayKey(day))}</Text>
            </Checkbox>
          ))}
        </Card>
      ) : null}

      {step === WizardStep.Review ? (
        <Card>
          <Text tone={TextTone.Muted}>{t('automation.wizard.reviewIntro')}</Text>
          <Text variant={TextVariant.Subheading}>{rule.name || t('automation.wizard.reviewNone')}</Text>
          <Text>{t('automation.ruleSummary', { tracks: rule.trackIds.length > 0 ? String(rule.trackIds.length) : t('automation.allTracks'), score: rule.filters.minMatchScore })}</Text>
          <Text>
            {t('automation.wizard.dailyCap')}: {rule.limits.dailyCap ?? t('automation.wizard.capNone')}
          </Text>
          <Text>
            {t('automation.wizard.weeklyCap')}: {rule.limits.weeklyCap ?? t('automation.wizard.capNone')}
          </Text>
          <SwitchRow label={t('automation.wizard.enabled')} value={rule.enabled} onChange={(value) => change({ enabled: value })} />
          {(attempted && failures.length > 0) || failed ? <Text tone={TextTone.Danger}>{t('automation.errors.save')}</Text> : null}
        </Card>
      ) : null}

      <View style={{ gap: theme.space.sm }}>
        <Button label={last ? t('automation.wizard.save') : t('automation.wizard.next')} onPress={next} loading={saving} fullWidth testID="rule-next" />
        <Button
          label={index === 0 ? t('automation.wizard.cancel') : t('automation.wizard.back')}
          variant={ButtonVariant.Secondary}
          onPress={index === 0 ? onCancel : () => setIndex(index - 1)}
          fullWidth
          testID="rule-back"
        />
      </View>
    </View>
  );
}
