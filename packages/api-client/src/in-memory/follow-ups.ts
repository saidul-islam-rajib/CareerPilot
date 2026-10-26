import { OutcomeStatus, TaskStatus, TimelineActor } from '@careerpilot/domain-ui-logic';
import { Locale, catalogs, createTranslator } from '@careerpilot/i18n';
import { ApiError, ApiErrorCode } from '../errors';
import type { Clock, IdGenerator } from '../ports';
import type { ApplicationRecord, FollowUpTask, OutcomeUpdate, PublicConfig, TaskInput, UpcomingTask } from '../types';

const DAY_MS = 86_400_000;
const WHITESPACE = /\s+/g;
const ZONED_ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/;
const EMPLOYER_OUTCOMES: ReadonlySet<OutcomeStatus> = new Set([
  OutcomeStatus.UnderReview,
  OutcomeStatus.Assessment,
  OutcomeStatus.Interview,
  OutcomeStatus.OfferReceived,
  OutcomeStatus.Admitted,
  OutcomeStatus.ConditionallyAdmitted,
  OutcomeStatus.Waitlisted,
  OutcomeStatus.Deferred,
  OutcomeStatus.Rejected,
]);
const STATUS_EVENTS: Readonly<Record<TaskStatus, string>> = {
  [TaskStatus.Open]: 'timeline.taskReopened',
  [TaskStatus.Done]: 'timeline.taskCompleted',
  [TaskStatus.Dismissed]: 'timeline.taskDismissed',
};
const translate = createTranslator(catalogs[Locale.English]);

export interface FollowUpOptions {
  applications: ApplicationRecord[];
  config: PublicConfig;
  clock: Clock;
  ids: IdGenerator;
  respond: <T>(value: T) => Promise<T>;
  reject: (code: ApiErrorCode, detail?: string) => Promise<never>;
}

function invalid(detail: string): never {
  throw new ApiError(ApiErrorCode.Validation, 422, detail);
}

function missing(detail: string): never {
  throw new ApiError(ApiErrorCode.NotFound, 404, detail);
}

function cleanLine(value: string): string {
  return value.replace(WHITESPACE, ' ').trim();
}

function cleanBlock(value: string): string {
  return value
    .trim()
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n');
}

function limited(value: string, max: number, detail: string): string {
  return value.length > max ? invalid(detail) : value;
}

function taskEvent(key: string, task: FollowUpTask): string {
  return translate(key, { kind: translate(`enums.task_kind.${task.kind}`), title: task.title });
}

export function createFollowUps(options: FollowUpOptions) {
  const { applications, config, clock, ids } = options;
  const limits = config.tracking;
  const nowIso = () => clock.now().toISOString();

  function checked(input: TaskInput): Omit<FollowUpTask, 'id' | 'status' | 'createdAt' | 'updatedAt'> {
    const title = cleanLine(input.title);
    if (!title) {
      invalid('title');
    }
    if (input.dueAt && (!ZONED_ISO.test(input.dueAt) || Number.isNaN(Date.parse(input.dueAt)))) {
      invalid('due_at');
    }
    return {
      kind: input.kind,
      title: limited(title, limits.taskTitleMaxLength, 'title'),
      ...(input.dueAt ? { dueAt: new Date(input.dueAt).toISOString() } : {}),
      location: limited(cleanLine(input.location), limits.taskLocationMaxLength, 'location'),
      notes: limited(cleanBlock(input.notes), limits.taskNotesMaxLength, 'notes'),
    };
  }

  async function change(id: string, apply: (record: ApplicationRecord, now: string) => void): Promise<ApplicationRecord> {
    try {
      const record = applications.find((a) => a.id === id) ?? missing('application');
      const now = nowIso();
      apply(record, now);
      record.updatedAt = now;
      return options.respond(record);
    } catch (error) {
      if (error instanceof ApiError) {
        return options.reject(error.code, error.detail);
      }
      throw error;
    }
  }

  const taskOf = (record: ApplicationRecord, taskId: string) => record.tasks.find((t) => t.id === taskId) ?? missing('task');

  return {
    updateOutcome: (id: string, update: OutcomeUpdate) =>
      change(id, (record, now) => {
        const note = limited(cleanBlock(update.note ?? ''), limits.outcomeNoteMaxLength, 'note');
        const outcome = translate(`enums.outcome_status.${update.outcome}`);
        record.outcomeStatus = update.outcome;
        if (EMPLOYER_OUTCOMES.has(update.outcome)) {
          record.lastContactAt = now;
        }
        record.timeline.push({ at: now, actor: TimelineActor.User, text: translate(note ? 'timeline.outcomeNoted' : 'timeline.outcomeSet', { outcome, note }) });
      }),
    addTask: (id: string, input: TaskInput) =>
      change(id, (record, now) => {
        const task: FollowUpTask = { id: ids.next('task'), ...checked(input), status: TaskStatus.Open, createdAt: now, updatedAt: now };
        record.tasks.push(task);
        record.timeline.push({ at: now, actor: TimelineActor.User, text: taskEvent('timeline.taskAdded', task) });
      }),
    editTask: (id: string, taskId: string, input: TaskInput) =>
      change(id, (record, now) => {
        const task = taskOf(record, taskId);
        const updated: FollowUpTask = { id: task.id, status: task.status, createdAt: task.createdAt, ...checked(input), updatedAt: now };
        record.tasks = record.tasks.map((t) => (t.id === taskId ? updated : t));
      }),
    setTaskStatus: (id: string, taskId: string, status: TaskStatus) =>
      change(id, (record, now) => {
        const updated = { ...taskOf(record, taskId), status, updatedAt: now };
        record.tasks = record.tasks.map((t) => (t.id === taskId ? updated : t));
        record.timeline.push({ at: now, actor: TimelineActor.User, text: taskEvent(STATUS_EVENTS[status], updated) });
      }),
    upcoming(): UpcomingTask[] {
      const horizon = clock.now().getTime() + limits.upcomingDays * DAY_MS;
      return applications
        .flatMap((record) =>
          record.tasks
            .filter((task) => task.status === TaskStatus.Open && task.dueAt !== undefined && Date.parse(task.dueAt) <= horizon)
            .map((task) => ({ applicationId: record.id, organization: record.opportunity.organization, title: record.opportunity.title, task })),
        )
        .sort((a, b) => (a.task.dueAt ?? '').localeCompare(b.task.dueAt ?? ''))
        .slice(0, limits.upcomingLimit);
    },
  };
}
