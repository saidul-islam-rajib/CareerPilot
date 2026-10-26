import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, View } from 'react-native';
import { AlertTriangle, Bell, CalendarClock, CheckCircle2, ClipboardCheck, Lightbulb, MessageSquare, Plus, Sparkles, UserCheck, type LucideIcon } from 'lucide-react-native';
import type { ApplicationRecord, FollowUpTask, UpcomingTask } from '@careerpilot/api-client';
import { useApplication, useApplicationActions, useFollowUpSuggestion, useFormat, useOutcomeForm, useServices, useT, useTaskForm, type TaskFormValues } from '@careerpilot/client-core';
import { EnumKey, OutcomeStatus, StatusTone, TaskKind, TaskStatus, enumValues } from '@careerpilot/domain-ui-logic';
import { Routes } from '@/core/navigation/routes';
import { useTheme } from '@/core/theme/theme';
import {
  Badge,
  Banner,
  Button,
  ButtonVariant,
  Card,
  ChoiceList,
  Divider,
  EnumBadge,
  ErrorState,
  Icon,
  IconButton,
  LoadingState,
  Row,
  Screen,
  Section,
  Text,
  TextField,
  TextTone,
  TextVariant,
  useSnackbar,
} from '@/ui';

const TASK_ICONS: Readonly<Record<TaskKind, LucideIcon>> = {
  [TaskKind.FollowUp]: Bell,
  [TaskKind.Interview]: CalendarClock,
  [TaskKind.Assessment]: ClipboardCheck,
  [TaskKind.Reference]: UserCheck,
  [TaskKind.Communication]: MessageSquare,
  [TaskKind.Other]: Sparkles,
};

function useOverdue() {
  const { clock } = useServices();
  const now = clock.now().getTime();
  return (task: FollowUpTask) => task.status === TaskStatus.Open && task.dueAt !== undefined && Date.parse(task.dueAt) < now;
}

function TaskSummary({ task, context }: { task: FollowUpTask; context?: string }) {
  const t = useT();
  const theme = useTheme();
  const format = useFormat();
  const overdue = useOverdue()(task);
  return (
    <View style={{ flex: 1, gap: theme.space.xxs }}>
      <Text variant={TextVariant.Subheading} style={task.status === TaskStatus.Done ? { textDecorationLine: 'line-through' } : undefined}>
        {task.title}
      </Text>
      {context ? (
        <Text variant={TextVariant.Caption} tone={TextTone.Muted}>
          {context}
        </Text>
      ) : null}
      <Row gap={theme.space.xs} wrap>
        <EnumBadge enumKey={EnumKey.TaskKind} value={task.kind} />
        {task.status !== TaskStatus.Open ? <EnumBadge enumKey={EnumKey.TaskStatus} value={task.status} /> : null}
        <Text variant={TextVariant.Caption} tone={overdue ? TextTone.Danger : TextTone.Muted}>
          {task.dueAt ? format.dateTime(task.dueAt) : t('applications.noDate')}
        </Text>
        {overdue ? <Badge label={t('applications.overdue')} tone={StatusTone.Danger} /> : null}
      </Row>
      {task.location ? (
        <Text variant={TextVariant.Caption} selectable>
          {task.location}
        </Text>
      ) : null}
    </View>
  );
}

export function FollowUpsCard({ application }: { application: ApplicationRecord }) {
  const t = useT();
  const theme = useTheme();
  const router = useRouter();
  const actions = useApplicationActions(application.id);
  const suggestion = useFollowUpSuggestion(application);
  const sorted = [...application.tasks].sort((a, b) => {
    const rank = (task: FollowUpTask) => (task.status === TaskStatus.Open ? 0 : 1);
    return rank(a) - rank(b) || (a.dueAt ?? '￿').localeCompare(b.dueAt ?? '￿');
  });
  return (
    <>
      {suggestion.show ? (
        <Banner
          tone={StatusTone.Info}
          icon={Lightbulb}
          title={t('applications.suggestionLabel')}
          body={t('applications.suggestedFollowUp', { days: suggestion.days })}
          action={<Button label={t('applications.addFollowUp')} icon={Plus} variant={ButtonVariant.Secondary} onPress={() => router.push(Routes.followUp(application.id, undefined, true))} testID="suggested-follow-up" />}
        />
      ) : null}
      <Section title={t('applications.followUps')}>
        <Card>
          {sorted.length === 0 ? <Text tone={TextTone.Muted}>{t('applications.followUpsEmpty')}</Text> : null}
          {sorted.map((task, index) => {
            const Glyph = TASK_ICONS[task.kind];
            return (
              <View key={task.id} style={{ gap: theme.space.sm }}>
                {index > 0 ? <Divider /> : null}
                <Row align="flex-start">
                  <Icon icon={Glyph} color={theme.colors.primary} />
                  <Pressable accessibilityRole="button" accessibilityLabel={`${t('common.edit')}: ${task.title}`} onPress={() => router.push(Routes.followUp(application.id, task.id))} style={{ flex: 1 }}>
                    <TaskSummary task={task} />
                  </Pressable>
                  {task.status === TaskStatus.Open ? (
                    <IconButton
                      icon={CheckCircle2}
                      label={`${t('applications.markDone')}: ${task.title}`}
                      onPress={() => actions.setTaskStatus.mutate({ taskId: task.id, status: TaskStatus.Done })}
                    />
                  ) : null}
                </Row>
              </View>
            );
          })}
          <Button label={t('applications.addFollowUp')} icon={Plus} variant={ButtonVariant.Outline} onPress={() => router.push(Routes.followUp(application.id))} testID="add-follow-up" />
        </Card>
      </Section>
    </>
  );
}

function FollowUpForm({ application, task, defaults }: { application: ApplicationRecord; task?: FollowUpTask; defaults?: Partial<TaskFormValues> }) {
  const t = useT();
  const router = useRouter();
  const snackbar = useSnackbar();
  const actions = useApplicationActions(application.id);
  const form = useTaskForm(application.id, {
    task,
    defaults,
    onSaved: () => {
      snackbar.show({ message: t('applications.taskSaved') });
      router.back();
    },
  });
  const kinds = enumValues(TaskKind).map((kind) => ({ value: kind, label: t(`enums.task_kind.${kind}`) }));
  const setStatus = (status: TaskStatus) => task && actions.setTaskStatus.mutate({ taskId: task.id, status }, { onSuccess: () => router.back() });
  return (
    <Screen testID="follow-up-screen">
      {form.formError ? <Banner tone={StatusTone.Danger} icon={AlertTriangle} title={t(form.formError)} /> : null}
      <Text tone={TextTone.Muted}>{`${application.opportunity.title} · ${application.opportunity.organization}`}</Text>
      <Card>
        <ChoiceList label={t('applications.taskKind')} choices={kinds} value={form.values.kind} onChange={(value) => form.setField('kind', value)} compact />
        <TextField
          label={t('applications.taskTitle')}
          hint={t('applications.taskTitleHint')}
          value={form.values.title}
          maxLength={form.limits.taskTitleMaxLength}
          onChangeText={(value) => form.setField('title', value)}
          error={form.errors.title}
          testID="task-title"
        />
        <Row align="flex-start">
          <View style={{ flex: 1 }}>
            <TextField
              label={t('applications.taskDate')}
              value={form.values.date}
              onChangeText={(value) => form.setField('date', value)}
              error={form.errors.date}
              placeholder={t('applications.datePlaceholder')}
              keyboardType="numbers-and-punctuation"
              testID="task-date"
            />
          </View>
          <View style={{ flex: 1 }}>
            <TextField
              label={t('applications.taskTime')}
              value={form.values.time}
              onChangeText={(value) => form.setField('time', value)}
              error={form.errors.time}
              placeholder={t('settings.timePlaceholder')}
              keyboardType="numbers-and-punctuation"
              testID="task-time"
            />
          </View>
        </Row>
        <Text variant={TextVariant.Caption} tone={TextTone.Muted}>
          {t('applications.taskWhenHint', { timeZone: form.timeZone })}
        </Text>
        <TextField label={t('applications.taskLocation')} value={form.values.location} maxLength={form.limits.taskLocationMaxLength} onChangeText={(value) => form.setField('location', value)} autoCapitalize="none" testID="task-location" />
        <TextField label={t('applications.taskNotes')} value={form.values.notes} maxLength={form.limits.taskNotesMaxLength} onChangeText={(value) => form.setField('notes', value)} multiline testID="task-notes" />
        <Button label={t('common.save')} onPress={form.submit} loading={form.saving} fullWidth testID="task-save" />
        {task && task.status === TaskStatus.Open ? (
          <Row>
            <Button label={t('applications.markDone')} icon={CheckCircle2} variant={ButtonVariant.Outline} onPress={() => setStatus(TaskStatus.Done)} style={{ flex: 1 }} />
            <Button label={t('applications.dismiss')} variant={ButtonVariant.Ghost} onPress={() => setStatus(TaskStatus.Dismissed)} style={{ flex: 1 }} />
          </Row>
        ) : null}
        {task && task.status !== TaskStatus.Open ? <Button label={t('applications.reopen')} variant={ButtonVariant.Outline} onPress={() => setStatus(TaskStatus.Open)} fullWidth /> : null}
      </Card>
    </Screen>
  );
}

function SuggestedForm({ application }: { application: ApplicationRecord }) {
  const t = useT();
  const suggestion = useFollowUpSuggestion(application);
  return <FollowUpForm application={application} defaults={{ ...suggestion.defaults, title: t('applications.followUpTitle') }} />;
}

export function FollowUpScreen() {
  const { applicationId, taskId, suggested } = useLocalSearchParams<{ applicationId: string; taskId?: string; suggested?: string }>();
  const application = useApplication(applicationId);
  if (application.isPending) {
    return <LoadingState />;
  }
  if (application.isError) {
    return <ErrorState onRetry={() => void application.refetch()} />;
  }
  const task = taskId ? application.data.tasks.find((item) => item.id === taskId) : undefined;
  return suggested ? <SuggestedForm application={application.data} /> : <FollowUpForm application={application.data} task={task} />;
}

function OutcomeForm({ application }: { application: ApplicationRecord }) {
  const t = useT();
  const router = useRouter();
  const snackbar = useSnackbar();
  const form = useOutcomeForm(application, {
    onSaved: () => {
      snackbar.show({ message: t('applications.outcomeSaved') });
      router.back();
    },
  });
  const outcomes = enumValues(OutcomeStatus).map((value) => ({ value, label: t(`enums.outcome_status.${value}`) }));
  return (
    <Screen testID="outcome-screen" footer={<Button label={t('common.save')} onPress={() => (form.changed ? form.submit() : router.back())} loading={form.saving} fullWidth testID="outcome-save" />}>
      {form.formError ? <Banner tone={StatusTone.Danger} icon={AlertTriangle} title={t(form.formError)} /> : null}
      <Card>
        <TextField label={t('applications.outcomeNote')} hint={t('applications.outcomeNoteHint')} value={form.note} maxLength={form.noteMaxLength} onChangeText={form.setNote} multiline testID="outcome-note" />
        {form.withdrawing ? <Banner tone={StatusTone.Warning} icon={AlertTriangle} title={t('applications.withdrawNote')} /> : null}
        <ChoiceList label={t('applications.outcome')} choices={outcomes} value={form.outcome} onChange={form.setOutcome} />
      </Card>
    </Screen>
  );
}

export function OutcomeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const application = useApplication(id);
  if (application.isPending) {
    return <LoadingState />;
  }
  if (application.isError) {
    return <ErrorState onRetry={() => void application.refetch()} />;
  }
  return <OutcomeForm application={application.data} />;
}

export function ComingUpSection({ items }: { items: UpcomingTask[] }) {
  const t = useT();
  const theme = useTheme();
  const router = useRouter();
  return (
    <Section title={t('applications.comingUp')}>
      <Card>
        {items.map(({ applicationId, organization, title, task }, index) => (
          <View key={task.id} style={{ gap: theme.space.sm }}>
            {index > 0 ? <Divider /> : null}
            <Pressable accessibilityRole="link" accessibilityLabel={`${task.title}, ${title}`} onPress={() => router.push(Routes.application(applicationId))}>
              <Row align="flex-start">
                <Icon icon={TASK_ICONS[task.kind]} color={theme.colors.primary} />
                <TaskSummary task={task} context={`${title} · ${organization}`} />
              </Row>
            </Pressable>
          </View>
        ))}
      </Card>
    </Section>
  );
}
