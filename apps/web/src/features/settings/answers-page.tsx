'use client';

import { useState } from 'react';
import { AlertTriangle, CheckCircle2, MessageSquareText, Pencil, Plus, Trash2 } from 'lucide-react';
import { AnswerSource, type QuestionGroup, type SavedAnswer, type SavedAnswerInput } from '@careerpilot/api-client';
import { useAnswerActions, useQuestionBank, useSavedAnswerForm, useT } from '@careerpilot/client-core';
import { AnswerTopic, EnumKey, StatusTone, enumValues } from '@careerpilot/domain-ui-logic';
import { Badge, Button, Card, EmptyState, EnumBadge, ErrorState, FormDialog, LoadingState, OverflowMenu, PageHeader, SelectField, TextAreaField, TextField, useToast } from '@careerpilot/ui-web';

const SOURCE_LABELS: Readonly<Record<AnswerSource, string>> = {
  [AnswerSource.Profile]: 'approvals.fromProfile',
  [AnswerSource.Ai]: 'approvals.aiDrafted',
  [AnswerSource.User]: 'answers.answer',
  [AnswerSource.Saved]: 'approvals.fromSaved',
};

interface DialogState {
  answer?: SavedAnswer;
  defaults?: Partial<SavedAnswerInput>;
  version: number;
}

function AnswerDialog({ answer, defaults, onClose }: { answer?: SavedAnswer; defaults?: Partial<SavedAnswerInput>; onClose: () => void }) {
  const t = useT();
  const toast = useToast();
  const form = useSavedAnswerForm({
    answer,
    defaults,
    onSaved: () => {
      toast.show({ message: t('answers.answerSaved') });
      onClose();
    },
  });
  const topics = enumValues(AnswerTopic).map((topic) => ({ value: topic, label: t(`enums.answer_topic.${topic}`) }));
  return (
    <FormDialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={answer ? t('answers.edit') : t('answers.add')}
      submitLabel={t('common.save')}
      submitting={form.saving}
      error={form.formError ? t(form.formError) : undefined}
      onSubmit={form.submit}
    >
      <SelectField label={t('answers.topic')} options={topics} value={form.values.topic} onValueChange={(value) => form.setTopic(value as AnswerTopic)} />
      <TextField label={t('answers.question')} value={form.values.question} maxLength={form.limits.questionMaxLength} onChange={(e) => form.setField('question', e.target.value)} error={form.errors.question} />
      <TextAreaField label={t('answers.answer')} value={form.values.answer} maxLength={form.answerMaxLength} rows={4} onChange={(e) => form.setField('answer', e.target.value)} error={form.errors.answer} />
    </FormDialog>
  );
}

function SavedRow({ answer, onEdit }: { answer: SavedAnswer; onEdit: () => void }) {
  const t = useT();
  const toast = useToast();
  const actions = useAnswerActions();
  const remove = () =>
    actions.remove.mutate(answer.id, {
      onSuccess: () => toast.show({ message: t('answers.removed'), actionLabel: t('common.undo'), onAction: () => actions.restore.mutate(answer.id) }),
    });
  return (
    <li className="flex items-start gap-3 py-3">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <EnumBadge enumKey={EnumKey.AnswerTopic} value={answer.topic} />
        <p className="font-semibold text-foreground">{answer.question}</p>
        <p className="whitespace-pre-wrap break-words text-sm text-muted">{answer.answer}</p>
      </div>
      <OverflowMenu
        label={t('common.moreActions', { item: answer.question })}
        items={[
          { label: t('common.edit'), icon: Pencil, onSelect: onEdit },
          { label: t('common.remove'), icon: Trash2, onSelect: remove, destructive: true },
        ]}
      />
    </li>
  );
}

function GroupRow({ group, onSave }: { group: QuestionGroup; onSave: () => void }) {
  const t = useT();
  return (
    <li className="flex flex-col gap-2 py-3 sm:flex-row sm:items-start">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="font-semibold text-foreground">{group.question}</p>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
          <EnumBadge enumKey={EnumKey.AnswerTopic} value={group.topic} />
          <span>{group.count === 1 ? t('answers.askedOnce') : t('answers.askedCount', { count: group.count })}</span>
          {group.lastSource ? <span>{t(SOURCE_LABELS[group.lastSource])}</span> : null}
        </div>
        {group.lastAnswer ? <p className="break-words text-sm text-muted">{t('answers.lastAnswer', { answer: group.lastAnswer })}</p> : null}
      </div>
      {group.savedAnswerId ? (
        <span className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-success">
          <CheckCircle2 className="size-4" aria-hidden />
          {t('answers.savedBadge')}
        </span>
      ) : (
        <Button variant="secondary" size="sm" icon={Plus} className="shrink-0 self-start" onClick={onSave} aria-label={`${t('answers.saveThis')}: ${group.question}`}>
          {group.needsAnswer ? t('approvals.answerNow') : t('answers.saveThis')}
        </Button>
      )}
    </li>
  );
}

export function AnswersPage() {
  const t = useT();
  const bank = useQuestionBank();
  const [dialog, setDialog] = useState<DialogState>();
  const open = (answer?: SavedAnswer, defaults?: Partial<SavedAnswerInput>) => setDialog((current) => ({ answer, defaults, version: (current?.version ?? 0) + 1 }));
  const fromGroup = (group: QuestionGroup) => open(undefined, { topic: group.topic, question: group.question, answer: group.lastAnswer });

  if (bank.isPending) {
    return <LoadingState />;
  }
  if (bank.isError) {
    return <ErrorState onRetry={() => void bank.refetch()} />;
  }
  const blocking = bank.data.groups.filter((g) => g.needsAnswer);
  const asked = bank.data.groups.filter((g) => !g.needsAnswer);
  return (
    <>
      <PageHeader
        title={t('answers.title')}
        description={t('answers.body')}
        actions={
          <Button icon={Plus} onClick={() => open()}>
            {t('answers.add')}
          </Button>
        }
      />
      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-6">
          {blocking.length > 0 ? (
            <section aria-labelledby="needs-answer-title" className="flex flex-col gap-3 rounded-card border border-warning bg-warning-subtle p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden />
                <div>
                  <h2 id="needs-answer-title" className="font-semibold text-foreground">
                    {t('answers.needsAnswer')}
                  </h2>
                  <p className="text-sm text-foreground">{t('answers.needsAnswerBody')}</p>
                </div>
              </div>
              <ul className="divide-y divide-border rounded-control bg-card px-4">
                {blocking.map((group) => (
                  <GroupRow key={group.key} group={group} onSave={() => fromGroup(group)} />
                ))}
              </ul>
            </section>
          ) : null}
          <section aria-labelledby="saved-answers-title">
            <Card className="gap-2">
              <div className="flex items-center gap-3">
                <MessageSquareText className="size-5 shrink-0 text-primary" aria-hidden />
                <h2 id="saved-answers-title" className="min-w-0 flex-1 text-lg font-semibold">
                  {t('answers.saved')}
                </h2>
                <Badge label={String(bank.data.saved.length)} tone={StatusTone.Neutral} />
              </div>
              {bank.data.saved.length === 0 ? (
                <EmptyState body={t('answers.savedEmpty')} />
              ) : (
                <ul className="divide-y divide-border">
                  {bank.data.saved.map((answer) => (
                    <SavedRow key={answer.id} answer={answer} onEdit={() => open(answer)} />
                  ))}
                </ul>
              )}
            </Card>
          </section>
        </div>
        <section aria-labelledby="asked-title">
          <Card className="gap-2">
            <h2 id="asked-title" className="text-lg font-semibold">
              {t('answers.asked')}
            </h2>
            {asked.length === 0 ? (
              <EmptyState body={t('answers.askedEmpty')} />
            ) : (
              <ul className="divide-y divide-border">
                {asked.map((group) => (
                  <GroupRow key={group.key} group={group} onSave={() => fromGroup(group)} />
                ))}
              </ul>
            )}
          </Card>
        </section>
      </div>
      {dialog ? <AnswerDialog key={dialog.version} answer={dialog.answer} defaults={dialog.defaults} onClose={() => setDialog(undefined)} /> : null}
    </>
  );
}
