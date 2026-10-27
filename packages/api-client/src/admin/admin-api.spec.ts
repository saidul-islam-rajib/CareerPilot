import { describe, expect, it, vi } from 'vitest';
import { AdminArea, AdminRole, EmergencyStopScope, OpportunityStatus, PermissionAction, SourceStatus, SubmissionStatus, UserAccountStatus } from '@careerpilot/domain-ui-logic';
import { ThemeKey } from '@careerpilot/ui-tokens';
import { ApiErrorCode, isApiError } from '../errors';
import { createHttpClient } from '../http/http-client';
import { buildDemoSeed } from '../in-memory/demo.seed';
import { sequentialIds } from '../ports';
import { fixedClock, fixedNow } from '../test-support';
import { buildAdminDemoSeed } from './admin-demo.seed';
import { createHttpAdminApi } from './http-admin-api';
import type { NewSource } from './admin-types';
import { createInMemoryAdminApi, paginate, type InMemoryAdminApiOptions } from './in-memory-admin-api';
import { can, permissionsForRole } from './permissions';

const LINK_TOKEN = 'admin-link-token';
const SUGGESTION: NewSource = { name: 'Remote jobs', connector: 'rss', url: 'https://jobs.example.org/remote.rss', defaults: { type: 'job', workArrangement: 'remote', location: 'Remote' } };
const NEW_PASSWORD = 'Str0ng!Password';

function createAdminApi(extra: Partial<InMemoryAdminApiOptions> = {}) {
  const userState = buildDemoSeed(fixedNow);
  return createInMemoryAdminApi({
    state: buildAdminDemoSeed(fixedNow, userState, 5),
    userState,
    clock: fixedClock,
    ids: sequentialIds(),
    latencyMs: 0,
    recentWindowDays: 7,
    chartDays: 14,
    completeProfilePercent: 80,
    linkTtlBounds: { min: 1, max: 60 },
    linkToken: LINK_TOKEN,
    ...extra,
  });
}

async function signedIn(email = 'admin@sober.com') {
  const api = createAdminApi();
  await api.auth.signIn({ email, password: 'admin@sober.com' });
  return api;
}

async function errorCode(promise: Promise<unknown>) {
  const error = await promise.catch((e: unknown) => e);
  return isApiError(error) ? error.code : undefined;
}

describe('permissions', () => {
  it('gives super admins every action and read-only admins only read', () => {
    const superAdmin = permissionsForRole(AdminRole.SuperAdmin);
    expect(can(superAdmin, AdminArea.Admins, PermissionAction.Delete)).toBe(true);
    const viewer = permissionsForRole(AdminRole.ReadOnly);
    expect(can(viewer, AdminArea.Users, PermissionAction.Read)).toBe(true);
    expect(can(viewer, AdminArea.Users, PermissionAction.Update)).toBe(false);
    expect(can(permissionsForRole(AdminRole.Support), AdminArea.Settings, PermissionAction.Read)).toBe(false);
  });
});

describe('paginate', () => {
  it('searches, filters by status, and pages', () => {
    const items = ['alpha:a', 'beta:b', 'alphabet:a'];
    const page = paginate(items, { search: 'ALPHA', status: 'a', page: 1, pageSize: 1 }, (i) => i, (i) => i.split(':')[1] ?? '');
    expect(page).toEqual({ items: ['alpha:a'], total: 2, page: 1, pageSize: 1 });
  });
});

describe('in-memory admin api', () => {
  it('signs in the local default admin and rejects wrong passwords', async () => {
    const api = createAdminApi();
    const session = await api.auth.signIn({ email: 'admin@sober.com', password: 'admin@sober.com' });
    expect(session.admin.role).toBe(AdminRole.SuperAdmin);
    expect(await errorCode(api.auth.signIn({ email: 'admin@sober.com', password: 'nope' }))).toBe(ApiErrorCode.InvalidCredentials);
  });

  it('computes dashboard figures from the data', async () => {
    const api = await signedIn();
    const dashboard = await api.dashboard.getDashboard();
    expect(dashboard.users.total).toBe(14);
    expect(dashboard.users.suspended).toBeGreaterThan(0);
    expect(dashboard.sources.failing).toBe(1);
    expect(dashboard.opportunities.flagged).toBe(1);
    expect(dashboard.applications.perDay).toHaveLength(14);
    expect(dashboard.applications.bySubmissionStatus.reduce((sum, c) => sum + c.count, 0)).toBe(dashboard.applications.total);
  });

  it('records sensitive views and changes in the audit log', async () => {
    const api = await signedIn();
    const detail = await api.users.getUser('usr_demo');
    expect(detail.secrets[0]).not.toHaveProperty('value');
    await api.users.suspendUser('usr_002', 'Spam');
    const audit = await api.audit.listAudit({ page: 1, pageSize: 5 });
    expect(audit.items.map((e) => e.action).slice(0, 2)).toEqual(['user.suspended', 'user.viewed_sensitive']);
    expect(audit.items[0]?.actorName).toBe('Super Admin');
  });

  it('suspends, reactivates, and pauses users', async () => {
    const api = await signedIn();
    expect((await api.users.suspendUser('usr_003', 'Check')).status).toBe(UserAccountStatus.Suspended);
    expect((await api.users.reactivateUser('usr_003')).status).toBe(UserAccountStatus.Active);
    expect((await api.users.pauseAutomation('usr_003')).status).toBe(UserAccountStatus.Paused);
    expect(await errorCode(api.users.getUser('missing'))).toBe(ApiErrorCode.NotFound);
  });

  it('manages opportunities and sources', async () => {
    const api = await signedIn();
    expect((await api.opportunities.flagOpportunity('opp_bd_ctg', 'Fee requested')).status).toBe(OpportunityStatus.Flagged);
    expect((await api.opportunities.markExpired('opp_bd_dhaka')).status).toBe(OpportunityStatus.Expired);
    expect((await api.sources.setSourceEnabled('src_university', false)).status).toBe(SourceStatus.Disabled);
    expect(await errorCode(api.sources.runSourceCheck('src_university'))).toBe(ApiErrorCode.Conflict);
    expect((await api.sources.runSourceCheck('src_gov_notices')).status).toBe(SourceStatus.Healthy);
  });

  it('cancels only queued applications', async () => {
    const api = await signedIn();
    expect((await api.applications.cancelQueued('app_admin_1', 'Incident')).submissionStatus).toBe(SubmissionStatus.Cancelled);
    expect(await errorCode(api.applications.cancelQueued('app_bay', 'Too late'))).toBe(ApiErrorCode.Conflict);
  });

  it('changes the theme and runs the emergency stop', async () => {
    const api = await signedIn();
    expect((await api.settings.updateSettings({ activeTheme: ThemeKey.Orchid })).activeTheme).toBe(ThemeKey.Orchid);
    const stopped = await api.settings.startEmergencyStop({ scope: EmergencyStopScope.AllUsers, reason: 'Portal incident' });
    expect(stopped.emergencyStop).toMatchObject({ active: true, reason: 'Portal incident' });
    expect((await api.dashboard.getDashboard()).emergencyStop.active).toBe(true);
    expect((await api.settings.endEmergencyStop()).emergencyStop.active).toBe(false);
  });

  it('sets the sign-up and reset link lifetime only within bounds', async () => {
    const api = await signedIn();
    expect((await api.settings.getSettings()).accountLinkTtlMinutes).toBe(5);
    for (const invalid of [0, 61, 2.5]) {
      expect(await errorCode(api.settings.updateSettings({ accountLinkTtlMinutes: invalid }))).toBe(ApiErrorCode.Validation);
    }
    expect((await api.settings.updateSettings({ accountLinkTtlMinutes: 15 })).accountLinkTtlMinutes).toBe(15);
  });

  it('manages admin accounts but never suspends the signed-in admin', async () => {
    const api = await signedIn();
    expect((await api.admins.setRole('adm_viewer', AdminRole.Support)).role).toBe(AdminRole.Support);
    expect((await api.admins.setSuspended('adm_ops', true)).suspended).toBe(true);
    expect(await errorCode(api.admins.setSuspended('adm_super', true))).toBe(ApiErrorCode.Conflict);
    expect(await errorCode(api.auth.signIn({ email: 'operations@sober.com', password: 'admin@sober.com' }))).toBe(ApiErrorCode.InvalidCredentials);
  });

  it('adds sources from suggestions and refuses unsafe, unknown, or repeated ones', async () => {
    const api = createAdminApi({ suggestedSources: [SUGGESTION] });
    await api.auth.signIn({ email: 'admin@sober.com', password: 'admin@sober.com' });
    expect(await api.sources.suggestedSources()).toEqual([SUGGESTION]);
    const added = await api.sources.addSource(SUGGESTION);
    expect(added.setup?.url).toBe(SUGGESTION.url);
    expect(await api.sources.suggestedSources()).toEqual([]);
    expect(await errorCode(api.sources.addSource(SUGGESTION))).toBe(ApiErrorCode.Conflict);
    expect(await errorCode(api.sources.addSource({ ...SUGGESTION, url: 'http://jobs.example.org/feed.rss' }))).toBe(ApiErrorCode.Validation);
    expect(await errorCode(api.sources.addSource({ ...SUGGESTION, url: 'https://jobs.example.org/a.rss', connector: 'ftp' }))).toBe(ApiErrorCode.Validation);
  });

  it('sets an admin password from an emailed link and signs in', async () => {
    const api = createAdminApi();
    expect(await errorCode(api.auth.inspectAccountLink(LINK_TOKEN))).toBe(ApiErrorCode.Validation);
    await api.auth.requestPasswordLink({ email: 'nobody@example.com' });
    expect(await errorCode(api.auth.inspectAccountLink(LINK_TOKEN))).toBe(ApiErrorCode.Validation);
    await api.auth.requestPasswordLink({ email: ' ADMIN@sober.com ' });
    expect((await api.auth.inspectAccountLink(LINK_TOKEN)).email).toBe('admin@sober.com');
    const session = await api.auth.completeAccountLink({ token: LINK_TOKEN, password: NEW_PASSWORD });
    expect(session.admin.email).toBe('admin@sober.com');
    expect(await errorCode(api.auth.inspectAccountLink(LINK_TOKEN))).toBe(ApiErrorCode.Validation);
    expect((await api.auth.signIn({ email: 'admin@sober.com', password: NEW_PASSWORD })).admin.email).toBe('admin@sober.com');
  });
});

describe('http admin api', () => {
  it('uses the admin path prefix and paging query', async () => {
    const fetchFn = vi.fn(async () => new Response(JSON.stringify({ items: [], total: 0, page: 2, pageSize: 10 }), { status: 200 }));
    const api = createHttpAdminApi(createHttpClient({ baseUrl: 'https://admin.example.com', timeoutMs: 1000, fetchFn: fetchFn as unknown as typeof fetch, getAccessToken: () => 'a' }));
    await api.users.listUsers({ page: 2, pageSize: 10, search: 'ay', status: 'active' });
    expect((fetchFn.mock.calls[0] as unknown as [string])[0]).toBe('https://admin.example.com/admin/v1/users?page=2&pageSize=10&search=ay&status=active');
  });

  it('sends admin link tokens in request bodies, never in the path', async () => {
    const fetchFn = vi.fn(async () => new Response(JSON.stringify({}), { status: 200 }));
    const api = createHttpAdminApi(createHttpClient({ baseUrl: 'https://admin.example.com', timeoutMs: 1000, fetchFn: fetchFn as unknown as typeof fetch, getAccessToken: () => undefined }));
    await api.auth.requestPasswordLink({ email: 'owner@example.com' });
    await api.auth.inspectAccountLink(LINK_TOKEN);
    await api.auth.completeAccountLink({ token: LINK_TOKEN, password: NEW_PASSWORD });
    const calls = fetchFn.mock.calls as unknown as [string, RequestInit][];
    expect(calls.map(([url]) => url)).toEqual([
      'https://admin.example.com/admin/v1/auth/password-link',
      'https://admin.example.com/admin/v1/auth/account-links/inspect',
      'https://admin.example.com/admin/v1/auth/account-links/complete',
    ]);
    expect(calls.every(([url]) => !url.includes(LINK_TOKEN))).toBe(true);
    expect(String(calls[1]?.[1].body)).toContain(LINK_TOKEN);
  });
});
