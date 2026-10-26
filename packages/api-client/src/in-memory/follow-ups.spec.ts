import { describe, expect, it } from 'vitest';
import { OutcomeStatus, TaskKind, TaskStatus } from '@careerpilot/domain-ui-logic';
import { ApiErrorCode, isApiError } from '../errors';
import { createTestApi } from '../test-support';

async function detail(promise: Promise<unknown>) {
  const error = await promise.catch((e: unknown) => e);
  return isApiError(error) ? { code: error.code, detail: error.detail } : undefined;
}

describe('in-memory follow-ups', () => {
  it('records outcomes and tasks like the server', async () => {
    const api = createTestApi();
    const rejected = await api.applications.updateOutcome('app_kite', { outcome: OutcomeStatus.Rejected, note: ' Role filled ' });
    expect(rejected.outcomeStatus).toBe(OutcomeStatus.Rejected);
    expect(rejected.timeline.at(-1)?.text).toBe('Outcome set to Rejected: Role filled');
    const added = await api.applications.addTask('app_kite', { kind: TaskKind.Interview, title: ' Video  call ', dueAt: '2026-10-21T04:00:00Z', location: '', notes: '' });
    const task = added.tasks.at(-1);
    expect(task).toMatchObject({ title: 'Video call', dueAt: '2026-10-21T04:00:00.000Z', status: TaskStatus.Open });
    expect(added.timeline.at(-1)?.text).toBe('Added Interview: Video call');
    const done = await api.applications.setTaskStatus('app_kite', task?.id ?? '', TaskStatus.Done);
    expect(done.tasks.at(-1)?.status).toBe(TaskStatus.Done);
    expect(done.submissionStatus).toBe(rejected.submissionStatus);
    const summary = (await api.applications.listApplications('all')).find((a) => a.id === 'app_kite');
    expect(summary && 'tasks' in summary).toBe(false);
  });

  it('validates input and lists open tasks coming up', async () => {
    const api = createTestApi();
    expect(await detail(api.applications.addTask('app_kite', { kind: TaskKind.Other, title: ' ', location: '', notes: '' }))).toEqual({ code: ApiErrorCode.Validation, detail: 'title' });
    expect((await detail(api.applications.addTask('app_kite', { kind: TaskKind.Other, title: 'Call', dueAt: '2026-10-21T10:00', location: '', notes: '' })))?.detail).toBe('due_at');
    expect((await detail(api.applications.setTaskStatus('app_kite', 'task_missing', TaskStatus.Done)))?.code).toBe(ApiErrorCode.NotFound);
    const upcoming = (await api.dashboard.getDashboard()).upcoming;
    expect(upcoming.map((u) => u.task.id)).toContain('task_bay_interview');
    expect(upcoming[0]).toMatchObject({ applicationId: 'app_bay', organization: 'Bay Digital Ltd' });
  });
});
