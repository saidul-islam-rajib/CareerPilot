import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { ApplicationRecord, ApplicationSummary, FollowUpTask, OutcomeUpdate, TaskInput } from '@careerpilot/api-client';
import { OutcomeStatus, TaskKind, TaskStatus, isoToZoned, zonedToIso, zonedToday } from '@careerpilot/domain-ui-logic';
import { ValidationMessage, type FieldErrors } from '@careerpilot/validation';
import { usePublicConfig } from '../config/public-config';
import { queryKeys } from '../query/query-keys';
import { useApi, useServices } from '../services/app-services';
import { profileErrorKey } from './use-profile';
import { useSettings } from './use-settings';

const DATE_VALUE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_VALUE = /^([01]\d|2[0-3]):[0-5]\d$/;
const DAY_MS = 86_400_000;
const TIME_NEEDS_DATE = 'applications.taskTimeNeedsDate';

export interface TaskFormValues {
  kind: TaskKind;
  title: string;
  date: string;
  time: string;
  location: string;
  notes: string;
}

export function useApplicationActions(id: string) {
  const api = useApi();
  const client = useQueryClient();
  const onSuccess = async (record: ApplicationRecord) => {
    client.setQueryData(queryKeys.application(id), record);
    await Promise.all([client.invalidateQueries({ queryKey: queryKeys.applicationsAll }), client.invalidateQueries({ queryKey: queryKeys.dashboard })]);
  };
  return {
    updateOutcome: useMutation({ mutationFn: (update: OutcomeUpdate) => api.applications.updateOutcome(id, update), onSuccess }),
    addTask: useMutation({ mutationFn: (input: TaskInput) => api.applications.addTask(id, input), onSuccess }),
    editTask: useMutation({ mutationFn: ({ taskId, input }: { taskId: string; input: TaskInput }) => api.applications.editTask(id, taskId, input), onSuccess }),
    setTaskStatus: useMutation({ mutationFn: ({ taskId, status }: { taskId: string; status: TaskStatus }) => api.applications.setTaskStatus(id, taskId, status), onSuccess }),
  };
}

export function useUserTimeZone(): string {
  const settings = useSettings();
  const { config } = usePublicConfig();
  return settings.data?.timeZone ?? config.defaultTimeZone;
}

export function useTaskForm(applicationId: string, { task, defaults, onSaved }: { task?: FollowUpTask; defaults?: Partial<TaskFormValues>; onSaved?: () => void } = {}) {
  const { config } = usePublicConfig();
  const timeZone = useUserTimeZone();
  const actions = useApplicationActions(applicationId);
  const limits = config.tracking;
  const due = task?.dueAt ? isoToZoned(task.dueAt, timeZone) : undefined;
  const [values, setValues] = useState<TaskFormValues>({
    kind: task?.kind ?? TaskKind.FollowUp,
    title: task?.title ?? '',
    date: due?.date ?? '',
    time: due?.time ?? '',
    location: task?.location ?? '',
    notes: task?.notes ?? '',
    ...defaults,
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const mutation = task ? actions.editTask : actions.addTask;

  const check = (): FieldErrors => {
    const found: FieldErrors = {};
    if (!values.title.trim()) {
      found.title = ValidationMessage.Required;
    }
    if (values.date && !DATE_VALUE.test(values.date)) {
      found.date = 'validation.date';
    }
    if (values.time && !TIME_VALUE.test(values.time)) {
      found.time = ValidationMessage.Time;
    } else if (values.time && !values.date) {
      found.date = TIME_NEEDS_DATE;
    }
    return found;
  };

  const submit = () => {
    const found = check();
    setErrors(found);
    if (Object.keys(found).length > 0) {
      return;
    }
    const dueAt = values.date ? zonedToIso(values.date, values.time || limits.defaultTaskTime, timeZone) : undefined;
    const input: TaskInput = { kind: values.kind, title: values.title, location: values.location, notes: values.notes, ...(dueAt ? { dueAt } : {}) };
    const done = { onSuccess: () => onSaved?.() };
    if (task) {
      actions.editTask.mutate({ taskId: task.id, input }, done);
    } else {
      actions.addTask.mutate(input, done);
    }
  };

  return {
    values,
    errors,
    limits,
    timeZone,
    setField: <K extends keyof TaskFormValues>(field: K, value: TaskFormValues[K]) => {
      setValues((current) => ({ ...current, [field]: value }));
      setErrors((current) => ({ ...current, [field]: undefined }));
    },
    submit,
    saving: mutation.isPending,
    formError: mutation.error ? profileErrorKey(mutation.error) : undefined,
  };
}

export function useOutcomeForm(application: ApplicationRecord, { onSaved }: { onSaved?: () => void } = {}) {
  const { config } = usePublicConfig();
  const actions = useApplicationActions(application.id);
  const [outcome, setOutcome] = useState<OutcomeStatus>(application.outcomeStatus);
  const [note, setNote] = useState('');
  const submit = () => {
    const update: OutcomeUpdate = { outcome, ...(note.trim() ? { note } : {}) };
    actions.updateOutcome.mutate(update, { onSuccess: () => onSaved?.() });
  };
  return {
    outcome,
    setOutcome,
    note,
    setNote,
    noteMaxLength: config.tracking.outcomeNoteMaxLength,
    withdrawing: outcome === OutcomeStatus.Withdrawn,
    changed: outcome !== application.outcomeStatus || note.trim().length > 0,
    submit,
    saving: actions.updateOutcome.isPending,
    formError: actions.updateOutcome.error ? profileErrorKey(actions.updateOutcome.error) : undefined,
  };
}

export function useFollowUpSuggestion(application: ApplicationSummary & { tasks?: FollowUpTask[] }) {
  const { config } = usePublicConfig();
  const { clock } = useServices();
  const timeZone = useUserTimeZone();
  const days = config.tracking.followUpAfterDays;
  const silent = application.outcomeStatus === OutcomeStatus.NoResponseYet && application.appliedAt !== undefined;
  const lastHeard = Date.parse(application.lastContactAt ?? application.appliedAt ?? '');
  const quietFor = silent ? Math.floor((clock.now().getTime() - lastHeard) / DAY_MS) : 0;
  const pending = (application.tasks ?? []).some((t) => t.kind === TaskKind.FollowUp && t.status === TaskStatus.Open);
  return {
    show: silent && quietFor >= days && !pending,
    days,
    defaults: { kind: TaskKind.FollowUp, date: zonedToday(clock.now(), timeZone) },
  };
}
