import { describe, expect, it, vi } from 'vitest';
import { HostPolicy, PortalFailure, StopReason } from '@careerpilot/domain-ui-logic';
import { ApiErrorCode } from '../errors';
import { sequentialIds } from '../ports';
import { createHttpClient } from '../http/http-client';
import { createHttpPortal } from './http';
import { createInMemoryPortal } from './in-memory';

const NOW = new Date('2026-10-20T06:00:00.000Z');
const respond = <T>(value: T) => Promise.resolve(JSON.parse(JSON.stringify(value)) as T);
const fail = (code: ApiErrorCode, detail?: string) => Promise.reject(Object.assign(new Error(code), { code, detail }));
const PERMISSIONS = { allowAccountCreation: true, acceptTerms: true, acceptPrivacy: true, allowEmailVerification: false };

function setup() {
  const submitted = vi.fn(() => fail(ApiErrorCode.NotFound));
  const portal = createInMemoryPortal({
    clock: { now: () => NOW },
    ids: sequentialIds(),
    respond,
    fail,
    userId: () => 'usr_1',
    applications: () => ({ submitted }),
  });
  return portal;
}

describe('in-memory portal', () => {
  it('starts off and needs acknowledgement to turn on', async () => {
    const { user } = setup();
    expect((await user.autopilot()).settings.enabled).toBe(false);
    await expect(user.enableAutopilot({ ...PERMISSIONS, acknowledged: false })).rejects.toMatchObject({
      detail: PortalFailure.NotAcknowledged,
    });
    const on = await user.enableAutopilot({ ...PERMISSIONS, acknowledged: true });
    expect(on.settings.enabled).toBe(true);
    expect((await user.disableAutopilot()).settings.enabled).toBe(false);
  });

  it('stores accounts and reveals the password only on request', async () => {
    const { user } = setup();
    const view = await user.addAccount({ host: 'Jobs.Example.com', email: 'a@example.com', password: 'pw-1' });
    expect(JSON.stringify(view)).not.toContain('pw-1');
    expect((await user.revealAccount(view.id)).password).toBe('pw-1');
    expect(await user.exportAccounts()).toHaveLength(1);
    await user.removeAccount(view.id);
    expect(await user.listAccounts()).toHaveLength(0);
  });

  it('keeps unreviewed hosts at review in readiness', async () => {
    const { admin } = setup();
    const report = await admin.requestReadiness('https://jobs.example.com/apply');
    expect(report.reasons).toEqual([StopReason.HostReview]);
    await admin.decideHost('jobs.example.com', { policy: HostPolicy.Allowed });
    expect((await admin.requestReadiness('https://jobs.example.com/apply')).reasons).toEqual([]);
  });
});

describe('http portal', () => {
  it('calls the versioned paths', async () => {
    const fetchFn = vi.fn(async () => new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } }));
    const api = createHttpPortal(
      createHttpClient({ baseUrl: 'https://api.example.com', timeoutMs: 1000, fetchFn: fetchFn as unknown as typeof fetch, getAccessToken: () => 't' }),
    );
    await api.revealAccount('a b');
    await api.disableAutopilot();
    const calls = fetchFn.mock.calls.map((call) => call as unknown as [string, { method: string }]);
    expect(calls.map(([url, init]) => `${init.method} ${url}`)).toEqual([
      'GET https://api.example.com/v1/portal/accounts/a%20b/secret',
      'DELETE https://api.example.com/v1/portal/autopilot',
    ]);
  });
});
