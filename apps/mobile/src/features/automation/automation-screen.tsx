import { useState } from 'react';
import { View } from 'react-native';
import type { AutomationRule, RuleInput } from '@careerpilot/api-client';
import {
  emptyRule,
  moveItem,
  ruleToInput,
  useAutomation,
  useAutomationSettings,
  useDeleteRule,
  useDryRun,
  useReorderRules,
  useSaveRule,
  useT,
} from '@careerpilot/client-core';
import { StatusTone } from '@careerpilot/domain-ui-logic';
import { SnackbarTone } from '@/ui/snackbar';
import { useTheme } from '@/core/theme/theme';
import { Badge, Button, ButtonVariant, Card, ErrorState, LoadingState, Screen, SortableList, Text, TextTone, TextVariant, useSnackbar } from '@/ui';
import { DryRunPanel, SettingsCard, SkippedCard, StatusCard, UserOnlyCard } from './automation-parts';
import { RuleWizard } from './rule-wizard';

interface Editing {
  rule?: AutomationRule;
  input: RuleInput;
}

interface RuleRowProps {
  rule: AutomationRule;
  previewing: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onPreview: () => void;
}

function RuleRow({ rule, previewing, onEdit, onDelete, onPreview }: RuleRowProps) {
  const t = useT();
  const theme = useTheme();
  const [confirming, setConfirming] = useState(false);
  return (
    <View style={{ flex: 1, gap: theme.space.xs }}>
      <Text variant={TextVariant.Subheading}>{rule.name}</Text>
      <Text tone={TextTone.Muted}>
        {t('automation.ruleSummary', { tracks: rule.trackIds.length > 0 ? String(rule.trackIds.length) : t('automation.allTracks'), score: rule.filters.minMatchScore })}
      </Text>
      <Badge label={rule.enabled ? t('automation.enabled') : t('automation.disabled')} tone={rule.enabled ? StatusTone.Success : StatusTone.Neutral} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.space.xs }}>
        <Button label={t('automation.dryRun.runRule')} variant={ButtonVariant.Secondary} loading={previewing} onPress={onPreview} testID={`rule-preview-${rule.id}`} />
        <Button label={t('automation.editRule')} variant={ButtonVariant.Secondary} onPress={onEdit} testID={`rule-edit-${rule.id}`} />
        {confirming ? (
          <>
            <Text tone={TextTone.Muted}>{t('automation.deleteConfirm', { name: rule.name })}</Text>
            <Button label={t('automation.deleteRule')} variant={ButtonVariant.Destructive} onPress={onDelete} testID={`rule-delete-confirm-${rule.id}`} />
            <Button label={t('automation.wizard.cancel')} variant={ButtonVariant.Secondary} onPress={() => setConfirming(false)} />
          </>
        ) : (
          <Button label={t('automation.deleteRule')} variant={ButtonVariant.Secondary} onPress={() => setConfirming(true)} testID={`rule-delete-${rule.id}`} />
        )}
      </View>
    </View>
  );
}

export function AutomationScreen() {
  const t = useT();
  const theme = useTheme();
  const snackbar = useSnackbar();
  const overview = useAutomation();
  const reorder = useReorderRules();
  const remove = useDeleteRule();
  const dryRun = useDryRun();
  const settings = useAutomationSettings();
  const [editing, setEditing] = useState<Editing | undefined>();
  const save = useSaveRule(editing?.rule?.id);

  if (overview.isPending) return <LoadingState />;
  if (overview.isError) return <ErrorState onRetry={() => void overview.refetch()} />;
  const data = overview.data;
  const atLimit = data.rules.length >= data.limits.maxRules;
  const preview = (ruleId?: string) => dryRun.mutate(ruleId, { onError: () => snackbar.show({ message: t('automation.errors.dryRun'), tone: SnackbarTone.Danger }) });

  if (editing) {
    return (
      <Screen testID="automation-wizard">
        <RuleWizard
          initial={editing.input}
          limits={data.limits}
          saving={save.isPending}
          failed={save.isError}
          onCancel={() => setEditing(undefined)}
          onSave={(input) => save.mutate(input, { onSuccess: () => setEditing(undefined) })}
        />
      </Screen>
    );
  }

  return (
    <Screen testID="automation-screen">
      <Text tone={TextTone.Muted}>{t('automation.intro')}</Text>
      <Button label={t('automation.dryRun.run')} variant={ButtonVariant.Secondary} loading={dryRun.isPending && dryRun.variables === undefined} onPress={() => preview()} fullWidth testID="automation-preview" />
      {dryRun.data ? <DryRunPanel result={dryRun.data} onClose={() => dryRun.reset()} /> : null}
      <StatusCard overview={data} />
      <Card>
        <Text variant={TextVariant.Subheading}>{t('automation.rulesTitle')}</Text>
        <Text tone={TextTone.Muted}>{data.rules.length === 0 ? t('automation.rulesEmpty') : t('automation.rulesHint')}</Text>
        {data.rules.length > 0 ? (
          <SortableList
            items={data.rules}
            keyOf={(rule) => rule.id}
            labelOf={(rule) => rule.name}
            onReorder={(from, to) => reorder.mutate(moveItem(data.rules, from, to).map((rule) => rule.id))}
            renderItem={(rule) => (
              <RuleRow
                rule={rule}
                previewing={dryRun.isPending && dryRun.variables === rule.id}
                onEdit={() => setEditing({ rule, input: ruleToInput(rule) })}
                onDelete={() => remove.mutate(rule.id)}
                onPreview={() => preview(rule.id)}
              />
            )}
          />
        ) : null}
        <View style={{ marginTop: theme.space.sm }}>
          <Button label={t('automation.addRule')} disabled={atLimit} onPress={() => setEditing({ input: emptyRule(data.limits) })} fullWidth testID="automation-add-rule" />
        </View>
      </Card>
      <SettingsCard key={JSON.stringify(data.settings)} overview={data} saving={settings.isPending} saved={settings.isSuccess} onSave={(input) => settings.mutate(input)} />
      <SkippedCard records={data.skipped} />
      <UserOnlyCard steps={data.userOnlySteps} />
    </Screen>
  );
}
