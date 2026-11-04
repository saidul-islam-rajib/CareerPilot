import { describe, expect, it, vi } from 'vitest';
import { CircularPhase, FeeStatus, GovApplicationStatus, SecretKind, StageStatus, GovStage } from '@careerpilot/domain-ui-logic';
import { ApiErrorCode, ApiErrorDetail, isApiError } from '../errors';
import { sequentialIds } from '../ports';
import { createHttpClient } from '../http/http-client';
import { circularQuery, createHttpGovernment } from './http';
import { createInMemoryGovernment } from './in-memory';
import { emptyCircularContent, emptyPost } from './types';

const clock = { now: () => new Date('2026-10-20T06:00:00.000Z') };
const respond = <T>(value: T) => Promise.resolve(JSON.parse(JSON.stringify(value)) as T);
const fail = (code: ApiErrorCode, detail?: string) => Promise.reject(Object.assign(new Error(code), { code, detail }));

function setup() {
  return createInMemoryGovernment({ clock, ids: sequentialIds(), respond, fail });
}

async function published(api: ReturnType<typeof setup>) {
  const content = {
    ...emptyCircularContent(),
    authority: 'Ministry',
    title: 'Recruitment',
    closesOn: '2026-11-12',
    fee: { amount: 112, windowHours: 48 },
    posts: [{ ...emptyPost(), title: 'Officer', grade: 9, vacancies: 3 }],
  };
  const created = await api.admin.createCircular(content);
  return api.admin.publishCircular(created.id);
}

describe('in-memory government', () => {
  it('shows only published circulars and filters by grade', async () => {
    const api = setup();
    const draft = await api.admin.createCircular({ ...emptyCircularContent(), authority: 'A', title: 'T', posts: [{ ...emptyPost(), title: 'P', grade: 9 }] });
    expect(await api.user.listCirculars()).toEqual([]);
    await api.admin.publishCircular(draft.id);
    expect((await api.user.listCirculars({ grades: [9] }))[0]).toMatchObject({ phase: CircularPhase.Open });
    expect(await api.user.listCirculars({ grades: [10] })).toEqual([]);
  });

  it('tracks an application, starts the payment deadline and refuses paid without evidence', async () => {
    const api = setup();
    const circular = await published(api);
    const started = await api.user.startApplication(circular.id, [circular.posts[0]!.id]);
    expect(started.fee.status).toBe(FeeStatus.Due);
    const submitted = await api.user.markSubmitted(started.id);
    expect(submitted.status).toBe(GovApplicationStatus.Submitted);
    expect(submitted.fee.paymentDeadline).toBe('2026-10-22T06:00:00.000Z');
    await expect(api.user.updateFee(started.id, { status: FeeStatus.Paid })).rejects.toMatchObject({ detail: ApiErrorDetail.EvidenceRequired });
    const paid = await api.user.updateFee(started.id, { status: FeeStatus.Paid, evidenceNote: 'SMS received' });
    expect(paid.fee.status).toBe(FeeStatus.Paid);
  });

  it('keeps credentials out of the application and reveals them on request', async () => {
    const api = setup();
    const circular = await published(api);
    const started = await api.user.startApplication(circular.id, [circular.posts[0]!.id]);
    const view = await api.user.setSecrets(started.id, { [SecretKind.Password]: 'secret-value' });
    expect(JSON.stringify(view)).not.toContain('secret-value');
    expect(view.secretsPresent).toEqual([SecretKind.Password]);
    expect(await api.user.revealSecrets(started.id)).toEqual({ [SecretKind.Password]: 'secret-value' });
  });

  it('records stages and refuses a second tracking of the same circular', async () => {
    const api = setup();
    const circular = await published(api);
    const started = await api.user.startApplication(circular.id, [circular.posts[0]!.id]);
    const withStage = await api.user.addStage(started.id, { stage: GovStage.Written, status: StageStatus.Scheduled, on: '2026-12-05' });
    expect(withStage.stages.map((s) => s.stage)).toContain(GovStage.Written);
    await expect(api.user.startApplication(circular.id, [circular.posts[0]!.id])).rejects.toMatchObject({ code: ApiErrorCode.Conflict });
    expect(isApiError(new Error('x'))).toBe(false);
  });
});

describe('government http', () => {
  it('builds the circular query', () => {
    expect(circularQuery()).toBe('');
    expect(circularQuery({ grades: [9, 10], eligibleOnly: true, authority: 'health' })).toBe('?grades=9%2C10&authority=health&eligibleOnly=true');
  });

  it('calls the versioned paths', async () => {
    const fetchFn = vi.fn(async () => new Response('[]', { status: 200, headers: { 'Content-Type': 'application/json' } }));
    const api = createHttpGovernment(
      createHttpClient({ baseUrl: 'https://api.example.com', timeoutMs: 1000, fetchFn: fetchFn as unknown as typeof fetch, getAccessToken: () => 't' }),
    );
    await api.listCirculars({ gradeMin: 9 });
    await api.upcoming();
    const urls = fetchFn.mock.calls.map((call) => (call as unknown as [string])[0]);
    expect(urls).toEqual(['https://api.example.com/v1/government/circulars?gradeMin=9', 'https://api.example.com/v1/government/upcoming']);
  });
});
