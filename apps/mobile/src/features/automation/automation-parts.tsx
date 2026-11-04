import { useState } from 'react';
import { View } from 'react-native';
import type { AutomationOverview, AutomationSettingsInput, DryRunItem, DryRunResult, SkippedRecord } from '@careerpilot/api-client';
import {
  DEADLINE_ACTIONS,
  actionKey,
  outcomeKey,
  parseCap,
  skipReasonKey,
  useFormat,
  useT,
  userOnlyKey,
  validateSettings,
} from '@careerpilot/client-core';
import { DryRunOutcome, StatusTone, type DeadlineAction, type SkipReason } from '@careerpilot/domain-ui-logic';
import { useTheme } from '@/core/theme/theme';
import { Badge, Button, ButtonVariant, Card, SelectField, Text, TextField, TextTone, TextVariant } from '@/ui';

const OUTCOME_TONES: Record<DryRunOutcome, StatusTone> = {
  [DryRunOutcome.WouldApply]: StatusTone.Success,
  [DryRunOutcome.Deferred]: StatusTone.Warning,
  [DryRunOutcome.Skipped]: StatusTone.Neutral,
};

export function StatusCard({ overview }: { overview: AutomationOverview }) {
  const t = useT();
  const theme = useTheme();
  const held = overview.holds.length > 0;
  return (
    <Card>
      <Text variant={TextVariant.Subheading}>{t('automation.statusTitle')}</Text>
      <Text tone={TextTone.Muted}>{held ? t('automation.statusHeld') : t('automation.statusRunning')}</Text>
      {held ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.space.xs }}>
          {overview.holds.map((hold) => (
            <Badge key={hold} label={t(skipReasonKey(hold))} tone={StatusTone.Warning} />
          ))}
        </View>
      ) : null}
      <Text>
        {t('automation.today')}: {overview.submittedToday} · {t('automation.thisWeek')}: {overview.submittedThisWeek}
      </Text>
      <Text tone={TextTone.Muted}>{t('automation.capsLine', { daily: overview.settings.dailyCap, weekly: overview.settings.weeklyCap })}</Text>
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
    <Card>
      <Text variant={TextVariant.Subheading}>{t('automation.settingsTitle')}</Text>
      <TextField label={t('automation.deadlineBuffer')} hint={t('automation.deadlineBufferHint')} value={buffer} keyboardType="number-pad" onChangeText={setBuffer} testID="settings-buffer" {...rangeError(0, limits.maxDeadlineBufferHours)} />
      <SelectField
        label={t('automation.deadlineAction')}
        placeholder={t(actionKey(action))}
        value={action}
        options={DEADLINE_ACTIONS.map((value) => ({ value, label: t(actionKey(value)) }))}
        onChange={(value) => setAction(value as DeadlineAction)}
      />
      <TextField label={t('automation.weeklyCap')} value={weekly} keyboardType="number-pad" onChangeText={setWeekly} testID="settings-weekly" {...rangeError(1, limits.maxWeeklyCap)} />
      <TextField label={t('automation.inactivity')} hint={t('automation.inactivityHint')} value={inactivity} keyboardType="number-pad" onChangeText={setInactivity} testID="settings-inactivity" {...rangeError(limits.minInactivityDays, limits.maxInactivityDays)} />
      <Button
        label={t('automation.saveSettings')}
        loading={saving}
        fullWidth
        testID="settings-save"
        onPress={() => {
          setAttempted(true);
          if (valid) onSave(input);
        }}
      />
      {saved ? <Text tone={TextTone.Muted}>{t('automation.saved')}</Text> : null}
    </Card>
  );
}

function Reasons({ reasons }: { reasons: SkipReason[] }) {
  const t = useT();
  return (
    <>
      {reasons.map((reason) => (
        <Text key={reason} variant={TextVariant.Caption} tone={TextTone.Muted}>
          {t(skipReasonKey(reason))}
        </Text>
      ))}
    </>
  );
}

function DryRunRow({ item }: { item: DryRunItem }) {
  const t = useT();
  const format = useFormat();
  return (
    <Card>
      <Text variant={TextVariant.Subheading}>{item.title}</Text>
      <Text tone={TextTone.Muted}>
        {item.organization} · {t('automation.dryRun.match', { score: item.matchScore })}
      </Text>
      <Badge label={t(outcomeKey(item.outcome))} tone={OUTCOME_TONES[item.outcome]} />
      <Text variant={TextVariant.Caption} tone={TextTone.Muted}>
        {item.ruleName ? t('automation.dryRun.rule', { name: item.ruleName }) : t('automation.dryRun.noRule')}
      </Text>
      <Reasons reasons={item.reasons} />
      {item.earliestAt ? <Text>{t('automation.dryRun.earliest', { at: format.dateTime(item.earliestAt) })}</Text> : null}
      {item.bypassesWindow ? <Text>{t('automation.dryRun.bypass')}</Text> : null}
      {item.materials ? (
        <>
          <Text variant={TextVariant.Label}>{t('automation.dryRun.materials')}</Text>
          <Text>{t('automation.dryRun.cv', { name: item.materials.cvName, version: item.materials.cvVersion })}</Text>
          <Text variant={TextVariant.Label}>{t('automation.dryRun.coverLetter')}</Text>
          <Text tone={TextTone.Muted}>{item.materials.coverLetter}</Text>
        </>
      ) : null}
    </Card>
  );
}

export function DryRunPanel({ result, onClose }: { result: DryRunResult; onClose: () => void }) {
  const t = useT();
  const theme = useTheme();
  return (
    <View style={{ gap: theme.space.sm }} testID="dry-run-result">
      <Card>
        <Text variant={TextVariant.Heading}>{t('automation.dryRun.title')}</Text>
        <Text tone={TextTone.Muted}>{t('automation.dryRun.safe')}</Text>
        <Text variant={TextVariant.Subheading}>{t('automation.dryRun.summary', { apply: result.wouldApply, deferred: result.deferred, skipped: result.skipped })}</Text>
        {result.holds.length > 0 ? (
          <Text>
            {t('automation.dryRun.heldBy')}: {result.holds.map((hold) => t(skipReasonKey(hold))).join(', ')}
          </Text>
        ) : null}
        {result.items.length === 0 ? <Text tone={TextTone.Muted}>{t('automation.dryRun.empty')}</Text> : null}
        <Button label={t('automation.dryRun.close')} variant={ButtonVariant.Secondary} onPress={onClose} fullWidth testID="dry-run-close" />
      </Card>
      {result.items.map((item) => (
        <DryRunRow key={item.opportunityId} item={item} />
      ))}
    </View>
  );
}

export function SkippedCard({ records }: { records: SkippedRecord[] }) {
  const t = useT();
  return (
    <Card>
      <Text variant={TextVariant.Subheading}>{t('automation.skippedTitle')}</Text>
      {records.length === 0 ? <Text tone={TextTone.Muted}>{t('automation.skippedEmpty')}</Text> : null}
      {records.map((record) => (
        <View key={record.opportunityId}>
          <Text variant={TextVariant.Label}>
            {record.title} · {record.organization}
          </Text>
          <Reasons reasons={record.reasons} />
        </View>
      ))}
    </Card>
  );
}

export function UserOnlyCard({ steps }: { steps: string[] }) {
  const t = useT();
  return (
    <Card>
      <Text variant={TextVariant.Subheading}>{t('automation.userOnlyTitle')}</Text>
      <Text tone={TextTone.Muted}>{t('automation.userOnlyBody')}</Text>
      {steps.map((step) => (
        <Text key={step}>• {t(userOnlyKey(step))}</Text>
      ))}
    </Card>
  );
}
