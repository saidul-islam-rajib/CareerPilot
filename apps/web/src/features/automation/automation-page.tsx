'use client';

import { useState } from 'react';
import { Pencil, Play, Plus, Trash2 } from 'lucide-react';
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
import { Badge, Button, Card, ConfirmDialog, EmptyState, ErrorState, LoadingState, PageHeader, Section, SortableList, useToast } from '@careerpilot/ui-web';
import { DryRunPanel, SettingsCard, SkippedCard, StatusCard, UserOnlyCard } from './automation-parts';
import { RuleWizard } from './rule-wizard';

interface Editing {
  rule?: AutomationRule;
  input: RuleInput;
}

function RuleRow({ rule, previewing, onEdit, onDelete, onPreview }: { rule: AutomationRule; previewing: boolean; onEdit: () => void; onDelete: () => void; onPreview: () => void }) {
  const t = useT();
  return (
    <div className="flex flex-1 flex-wrap items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="font-semibold">{rule.name}</p>
        <p className="text-sm text-muted">
          {t('automation.ruleSummary', { tracks: rule.trackIds.length > 0 ? String(rule.trackIds.length) : t('automation.allTracks'), score: rule.filters.minMatchScore })}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Badge label={rule.enabled ? t('automation.enabled') : t('automation.disabled')} tone={rule.enabled ? StatusTone.Success : StatusTone.Neutral} />
        <Button variant="outline" icon={Play} loading={previewing} onClick={onPreview} aria-label={`${t('automation.dryRun.runRule')}: ${rule.name}`}>
          {t('automation.dryRun.title')}
        </Button>
        <Button variant="outline" icon={Pencil} onClick={onEdit} aria-label={`${t('automation.editRule')}: ${rule.name}`}>
          {t('automation.editRule')}
        </Button>
        <ConfirmDialog
          title={t('automation.deleteRule')}
          body={t('automation.deleteConfirm', { name: rule.name })}
          confirmLabel={t('automation.deleteRule')}
          destructive
          onConfirm={onDelete}
          trigger={
            <Button variant="outline" icon={Trash2} aria-label={`${t('automation.deleteRule')}: ${rule.name}`}>
              {t('automation.deleteRule')}
            </Button>
          }
        />
      </div>
    </div>
  );
}

export function AutomationPage() {
  const t = useT();
  const toast = useToast();
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

  const preview = (ruleId?: string) =>
    dryRun.mutate(ruleId, { onError: () => toast.show({ message: t('automation.errors.dryRun') }) });

  return (
    <>
      <PageHeader
        title={t('automation.title')}
        description={t('automation.intro')}
        actions={
          <Button variant="outline" icon={Play} loading={dryRun.isPending && dryRun.variables === undefined} onClick={() => preview()}>
            {t('automation.dryRun.run')}
          </Button>
        }
      />
      {editing ? (
        <RuleWizard
          initial={editing.input}
          limits={data.limits}
          saving={save.isPending}
          failed={save.isError}
          onCancel={() => setEditing(undefined)}
          onSave={(input) => save.mutate(input, { onSuccess: () => setEditing(undefined) })}
        />
      ) : (
        <div className="flex flex-col gap-6">
          {dryRun.data ? <DryRunPanel result={dryRun.data} onClose={() => dryRun.reset()} /> : null}
          <div className="grid gap-4 md:grid-cols-2">
            <StatusCard overview={data} />
            <SettingsCard key={JSON.stringify(data.settings)} overview={data} saving={settings.isPending} saved={settings.isSuccess} onSave={(input) => settings.mutate(input)} />
          </div>
          <Section
            title={t('automation.rulesTitle')}
            action={
              <Button icon={Plus} disabled={atLimit} onClick={() => setEditing({ input: emptyRule(data.limits) })}>
                {t('automation.addRule')}
              </Button>
            }
          >
            <p className="text-sm text-muted">{data.rules.length === 0 ? t('automation.rulesEmpty') : t('automation.rulesHint')}</p>
            {data.rules.length === 0 ? (
              <EmptyState />
            ) : (
              <Card>
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
              </Card>
            )}
          </Section>
          <div className="grid gap-4 md:grid-cols-2">
            <SkippedCard records={data.skipped} />
            <UserOnlyCard steps={data.userOnlySteps} />
          </div>
        </div>
      )}
    </>
  );
}
