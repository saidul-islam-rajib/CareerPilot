'use client';

import { useState } from 'react';
import { AlertTriangle, Bell, CalendarClock, CheckCircle2, ClipboardCheck, Lightbulb, MapPin, MessageSquare, Pencil, Plus, RotateCcw, Sparkles, UserCheck, XCircle, type LucideIcon } from 'lucide-react';
import type { ApplicationRecord, FollowUpTask } from '@careerpilot/api-client';
import { useApplicationActions, useFollowUpSuggestion, useFormat, useOutcomeForm, useServices, useT, useTaskForm, type TaskFormValues } from '@careerpilot/client-core';
import { EnumKey, OutcomeStatus, StatusTone, TaskKind, TaskStatus, enumValues } from '@careerpilot/domain-ui-logic';
import { Badge, Banner, Button, Card, EnumBadge, FormDialog, OverflowMenu, SelectField, TextAreaField, TextField, cn, useToast } from '@careerpilot/ui-web';

const TASK_ICONS: Readonly<Record<TaskKind, LucideIcon>> = {
  [TaskKind.FollowUp]: Bell,
  [TaskKind.Interview]: CalendarClock,
  [TaskKind.Assessment]: ClipboardCheck,
  [TaskKind.Reference]: UserCheck,
  [TaskKind.Communication]: MessageSquare,
  [TaskKind.Other]: Sparkles,
};
const WEB_LINK = /^https?:\/\//i;

function TaskDialog({ applicationId, task, defaults, onClose }: { applicationId: string; task?: FollowUpTask; defaults?: Partial<TaskFormValues>; onClose: () => void }) {
  const t = useT();
  const toast = useToast();
  const form = useTaskForm(applicationId, {
    task,
    defaults,
    onSaved: () => {
      toast.show({ message: t('applications.taskSaved') });
      onClose();
    },
  });
  const kinds = enumValues(TaskKind).map((kind) => ({ value: kind, label: t(`enums.task_kind.${kind}`) }));
  return (
    <FormDialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={task ? t('applications.editFollowUp') : t('applications.addFollowUp')}
      submitLabel={t('common.save')}
      submitting={form.saving}
      error={form.formError ? t(form.formError) : undefined}
      onSubmit={form.submit}
    >
      <SelectField label={t('applications.taskKind')} options={kinds} value={form.values.kind} onValueChange={(value) => form.setField('kind', value as TaskKind)} />
      <TextField
        label={t('applications.taskTitle')}
        hint={t('applications.taskTitleHint')}
        value={form.values.title}
        maxLength={form.limits.taskTitleMaxLength}
        onChange={(e) => form.setField('title', e.target.value)}
        error={form.errors.title}
        required
      />
      <div className="flex flex-col gap-1">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <TextField type="date" label={t('applications.taskDate')} value={form.values.date} onChange={(e) => form.setField('date', e.target.value)} error={form.errors.date} />
          <TextField type="time" label={t('applications.taskTime')} value={form.values.time} onChange={(e) => form.setField('time', e.target.value)} error={form.errors.time} />
        </div>
        <p className="text-xs text-muted">{t('applications.taskWhenHint', { timeZone: form.timeZone })}</p>
      </div>
      <TextField label={t('applications.taskLocation')} value={form.values.location} maxLength={form.limits.taskLocationMaxLength} onChange={(e) => form.setField('location', e.target.value)} />
      <TextAreaField label={t('applications.taskNotes')} value={form.values.notes} maxLength={form.limits.taskNotesMaxLength} rows={4} onChange={(e) => form.setField('notes', e.target.value)} />
    </FormDialog>
  );
}

export function OutcomeDialog({ application, onClose }: { application: ApplicationRecord; onClose: () => void }) {
  const t = useT();
  const toast = useToast();
  const form = useOutcomeForm(application, {
    onSaved: () => {
      toast.show({ message: t('applications.outcomeSaved') });
      onClose();
    },
  });
  const outcomes = enumValues(OutcomeStatus).map((value) => ({ value, label: t(`enums.outcome_status.${value}`) }));
  return (
    <FormDialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={t('applications.updateOutcome')}
      submitLabel={t('common.save')}
      submitting={form.saving}
      error={form.formError ? t(form.formError) : undefined}
      onSubmit={() => (form.changed ? form.submit() : onClose())}
    >
      <SelectField label={t('applications.outcome')} options={outcomes} value={form.outcome} onValueChange={(value) => form.setOutcome(value as OutcomeStatus)} />
      {form.withdrawing ? <Banner tone={StatusTone.Warning} icon={AlertTriangle} title={t('applications.withdrawNote')} /> : null}
      <TextAreaField label={t('applications.outcomeNote')} hint={t('applications.outcomeNoteHint')} value={form.note} maxLength={form.noteMaxLength} rows={3} onChange={(e) => form.setNote(e.target.value)} />
    </FormDialog>
  );
}

function TaskRow({ applicationId, task, onEdit }: { applicationId: string; task: FollowUpTask; onEdit: () => void }) {
  const t = useT();
  const format = useFormat();
  const toast = useToast();
  const { clock } = useServices();
  const actions = useApplicationActions(applicationId);
  const Glyph = TASK_ICONS[task.kind];
  const open = task.status === TaskStatus.Open;
  const overdue = open && task.dueAt !== undefined && Date.parse(task.dueAt) < clock.now().getTime();
  const setStatus = (status: TaskStatus) => actions.setTaskStatus.mutate({ taskId: task.id, status }, { onError: () => toast.show({ message: t('common.errorBody') }) });
  return (
    <li className={cn('flex items-start gap-3 py-3', !open && 'opacity-70')}>
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-subtle text-primary">
        <Glyph className="size-4" aria-hidden />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className={cn('font-semibold text-foreground', task.status === TaskStatus.Done && 'line-through')}>{task.title}</p>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
          <EnumBadge enumKey={EnumKey.TaskKind} value={task.kind} />
          {!open ? <EnumBadge enumKey={EnumKey.TaskStatus} value={task.status} /> : null}
          <span className={cn(overdue && 'font-semibold text-danger')}>{task.dueAt ? format.dateTime(task.dueAt) : t('applications.noDate')}</span>
          {overdue ? <Badge label={t('applications.overdue')} tone={StatusTone.Danger} /> : null}
        </div>
        {task.location ? (
          <p className="flex min-w-0 items-center gap-1 text-sm">
            <MapPin className="size-4 shrink-0 text-muted" aria-hidden />
            {WEB_LINK.test(task.location) ? (
              <a href={task.location} target="_blank" rel="noopener noreferrer" className="truncate text-primary underline-offset-2 hover:underline">
                {task.location}
              </a>
            ) : (
              <span className="min-w-0 break-words">{task.location}</span>
            )}
          </p>
        ) : null}
        {task.notes ? <p className="whitespace-pre-wrap text-sm text-muted">{task.notes}</p> : null}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {open ? (
          <Button variant="ghost" size="icon" icon={CheckCircle2} aria-label={`${t('applications.markDone')}: ${task.title}`} onClick={() => setStatus(TaskStatus.Done)} />
        ) : null}
        <OverflowMenu
          label={t('common.moreActions', { item: task.title })}
          items={[
            { label: t('common.edit'), icon: Pencil, onSelect: onEdit },
            open
              ? { label: t('applications.dismiss'), icon: XCircle, onSelect: () => setStatus(TaskStatus.Dismissed) }
              : { label: t('applications.reopen'), icon: RotateCcw, onSelect: () => setStatus(TaskStatus.Open) },
          ]}
        />
      </div>
    </li>
  );
}

export function FollowUpsSection({ application }: { application: ApplicationRecord }) {
  const t = useT();
  const suggestion = useFollowUpSuggestion(application);
  const [dialog, setDialog] = useState<{ task?: FollowUpTask; defaults?: Partial<TaskFormValues>; version: number }>();
  const open = (task?: FollowUpTask, defaults?: Partial<TaskFormValues>) => setDialog((current) => ({ task, defaults, version: (current?.version ?? 0) + 1 }));
  const sorted = [...application.tasks].sort((a, b) => {
    const rank = (task: FollowUpTask) => (task.status === TaskStatus.Open ? 0 : 1);
    return rank(a) - rank(b) || (a.dueAt ?? '￿').localeCompare(b.dueAt ?? '￿');
  });
  return (
    <section aria-labelledby="follow-ups-title" className="flex flex-col gap-3">
      {suggestion.show ? (
        <Banner
          tone={StatusTone.Info}
          icon={Lightbulb}
          title={t('applications.suggestionLabel')}
          body={t('applications.suggestedFollowUp', { days: suggestion.days })}
          action={
            <Button size="sm" variant="secondary" icon={Plus} onClick={() => open(undefined, { ...suggestion.defaults, title: t('applications.followUpTitle') })}>
              {t('applications.addFollowUp')}
            </Button>
          }
        />
      ) : null}
      <Card className="gap-2">
        <div className="flex items-center gap-3">
          <h2 id="follow-ups-title" className="min-w-0 flex-1 text-lg font-semibold">
            {t('applications.followUps')}
          </h2>
          <Button variant="secondary" size="sm" icon={Plus} onClick={() => open()}>
            {t('applications.addFollowUp')}
          </Button>
        </div>
        {sorted.length === 0 ? (
          <p className="text-sm text-muted">{t('applications.followUpsEmpty')}</p>
        ) : (
          <ul className="divide-y divide-border">
            {sorted.map((task) => (
              <TaskRow key={task.id} applicationId={application.id} task={task} onEdit={() => open(task)} />
            ))}
          </ul>
        )}
      </Card>
      {dialog ? <TaskDialog key={dialog.version} applicationId={application.id} task={dialog.task} defaults={dialog.defaults} onClose={() => setDialog(undefined)} /> : null}
    </section>
  );
}
