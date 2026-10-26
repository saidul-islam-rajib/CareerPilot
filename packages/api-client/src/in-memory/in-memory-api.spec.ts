import { describe, expect, it } from 'vitest';
import {
  ApplicationMode,
  ApprovalState,
  OpportunityDecision,
  PauseDuration,
  SubmissionStatus,
  SubmissionWindowKind,
} from '@careerpilot/domain-ui-logic';
import { ApiErrorCode, isApiError } from '../errors';
import { TEST_LINK_TOKEN, createTestApi, fixedNow } from '../test-support';
import { AccountLinkPurpose, AnswerSource, ApplicationFilter } from '../types';

async function expectError(promise: Promise<unknown>, code: ApiErrorCode) {
  const error = await promise.catch((e: unknown) => e);
  expect(isApiError(error, code)).toBe(true);
}

describe('in-memory auth', () => {
  it('signs in the local default account and records the sign-in', async () => {
    const api = createTestApi();
    const session = await api.auth.signIn({ email: 'ADMIN@sober.com ', password: 'admin@sober.com' });
    expect(session.user.email).toBe('admin@sober.com');
    const activity = await api.settings.listSignInActivity();
    expect(activity[0]?.success).toBe(true);
  });

  it('rejects wrong credentials and records a failed attempt', async () => {
    const api = createTestApi();
    await expectError(api.auth.signIn({ email: 'admin@sober.com', password: 'wrong' }), ApiErrorCode.InvalidCredentials);
    expect((await api.settings.listSignInActivity())[0]?.success).toBe(false);
  });

  it('registers by demo link, then signs in with the chosen password', async () => {
    const api = createTestApi();
    const request = { fullName: 'New User', email: 'New@example.com', consent: true, consentDocuments: { terms: '1', privacy: '1' } };
    await expect(api.auth.register(request)).resolves.toBeUndefined();
    await expectError(api.auth.signIn({ email: 'new@example.com', password: '' }), ApiErrorCode.InvalidCredentials);
    expect(await api.auth.inspectAccountLink(TEST_LINK_TOKEN)).toEqual({ purpose: AccountLinkPurpose.Setup, fullName: 'New User', email: 'new@example.com' });
    await expectError(api.auth.completeAccountLink({ token: TEST_LINK_TOKEN, password: 'short' }), ApiErrorCode.Validation);
    const session = await api.auth.completeAccountLink({ token: TEST_LINK_TOKEN, password: 'Str0ng!Password' });
    expect(session.user.email).toBe('new@example.com');
    await expectError(api.auth.completeAccountLink({ token: TEST_LINK_TOKEN, password: 'Str0ng!Password' }), ApiErrorCode.Validation);
    expect((await api.auth.signIn({ email: 'new@example.com', password: 'Str0ng!Password' })).user.fullName).toBe('New User');
    await expectError(api.auth.register({ ...request, email: 'other@example.com', consent: false }), ApiErrorCode.Validation);
  });

  it('answers the same for existing emails and resets passwords by link', async () => {
    const api = createTestApi();
    await api.auth.register({ fullName: 'Someone', email: 'admin@sober.com', consent: true, consentDocuments: { terms: '1', privacy: '1' } });
    await expectError(api.auth.inspectAccountLink(TEST_LINK_TOKEN), ApiErrorCode.Validation);
    await api.auth.requestPasswordReset('admin@sober.com');
    expect((await api.auth.inspectAccountLink(TEST_LINK_TOKEN)).purpose).toBe(AccountLinkPurpose.Reset);
    await api.auth.completeAccountLink({ token: TEST_LINK_TOKEN, password: 'N3w!Password99' });
    await expectError(api.auth.signIn({ email: 'admin@sober.com', password: 'admin@sober.com' }), ApiErrorCode.InvalidCredentials);
    expect((await api.auth.signIn({ email: 'admin@sober.com', password: 'N3w!Password99' })).user.id).toBe('usr_demo');
  });
});

describe('in-memory dashboard and opportunities', () => {
  it('builds track digests limited by result count and sorted by match', async () => {
    const api = createTestApi();
    await api.settings.updateTrack('trk_remote', { resultCount: 1 });
    const dashboard = await api.dashboard.getDashboard();
    const remote = dashboard.tracks.find((t) => t.track.id === 'trk_remote');
    expect(remote?.opportunities.map((o) => o.id)).toEqual(['opp_remote_frontend']);
    expect(dashboard.counts.awaitingApproval).toBe(2);
    expect(dashboard.tracks.map((t) => t.track.position)).toEqual([1, 2, 3, 4, 5]);
  });

  it('hides dismissed opportunities', async () => {
    const api = createTestApi();
    await api.opportunities.decide('opp_bd_dhaka', OpportunityDecision.Dismissed);
    const dashboard = await api.dashboard.getDashboard();
    expect(dashboard.tracks.flatMap((t) => t.opportunities.map((o) => o.id))).not.toContain('opp_bd_dhaka');
  });

  it('returns the archived circular with opportunity details', async () => {
    const detail = await createTestApi().opportunities.getOpportunity('opp_remote_frontend');
    expect(detail.circular.text).toContain('Senior Frontend Engineer');
    await expectError(createTestApi().opportunities.getOpportunity('missing'), ApiErrorCode.NotFound);
  });

  it('prepares one pending approval per opportunity', async () => {
    const api = createTestApi();
    const first = await api.opportunities.prepareApplication('opp_bd_ctg');
    const second = await api.opportunities.prepareApplication('opp_bd_ctg');
    expect(first.id).toBe(second.id);
    expect(first.state).toBe(ApprovalState.Pending);
    expect(new Date(first.expiresAt).getTime()).toBeGreaterThan(fixedNow.getTime());
  });
});

describe('in-memory approvals', () => {
  it('edits an answer and marks it as user provided', async () => {
    const api = createTestApi();
    const updated = await api.approvals.updateAnswer('apr_frontend', 'q_notice', '15 days');
    expect(updated.materials.answers.find((a) => a.id === 'q_notice')).toMatchObject({ answer: '15 days', source: AnswerSource.User });
  });

  it('approving queues an application automatically and cannot be repeated', async () => {
    const api = createTestApi();
    const approved = await api.approvals.approve('apr_frontend');
    expect(approved.state).toBe(ApprovalState.Approved);
    expect(approved.submissionWindowLabel).toBe('00:00–01:00');
    const active = await api.applications.listApplications(ApplicationFilter.Active);
    expect(active.some((a) => a.opportunity.id === 'opp_remote_frontend' && a.submissionStatus === SubmissionStatus.ApprovedQueued)).toBe(true);
    await expectError(api.approvals.approve('apr_frontend'), ApiErrorCode.Conflict);
    expect((await api.approvals.listApprovals()).map((a) => a.id)).toEqual(['apr_oslo']);
  });

  it('rejects an approval', async () => {
    const api = createTestApi();
    expect((await api.approvals.reject('apr_oslo')).state).toBe(ApprovalState.Rejected);
  });
});

describe('in-memory applications', () => {
  it('filters by status group', async () => {
    const api = createTestApi();
    const attention = await api.applications.listApplications(ApplicationFilter.Attention);
    expect(attention.map((a) => a.submissionStatus).sort()).toEqual([SubmissionStatus.ManualActionRequired, SubmissionStatus.OutcomeUnknown].sort());
    expect((await api.applications.listApplications(ApplicationFilter.All)).length).toBe(4);
  });

  it('returns the full submission record', async () => {
    const record = await createTestApi().applications.getApplication('app_bay');
    expect(record.emails[0]?.to).toBe('careers@baydigital.example.com');
    expect(record.timeline.length).toBeGreaterThan(0);
  });
});

describe('in-memory profile and settings', () => {
  it('reorders contacts and validates the id set', async () => {
    const api = createTestApi();
    const profile = await api.profile.getProfile();
    const reversed = [...profile.contacts].reverse().map((c) => c.id);
    const updated = await api.profile.reorderContacts(reversed);
    expect(updated.contacts.map((c) => c.id)).toEqual(reversed);
    expect(updated.contacts.map((c) => c.position)).toEqual([1, 2, 3, 4]);
    await expectError(api.profile.reorderContacts(['c_email_work']), ApiErrorCode.Validation);
  });

  it('keeps one primary contact per kind', async () => {
    const updated = await createTestApi().profile.setPrimaryContact('c_email_personal');
    const primaries = (kind: string) => updated.contacts.filter((c) => c.kind === kind && c.isPrimary).map((c) => c.id);
    expect(primaries('email')).toEqual(['c_email_personal']);
    expect(primaries('phone')).toEqual(['c_phone_mobile']);
  });

  it('validates track updates against policy', async () => {
    const api = createTestApi();
    await expectError(api.settings.updateTrack('trk_remote', { resultCount: 0 }), ApiErrorCode.Validation);
    expect((await api.settings.updateTrack('trk_remote', { resultCount: 10, mode: ApplicationMode.Automatic })).mode).toBe(ApplicationMode.Automatic);
  });

  it('pauses for a duration, indefinitely, and resumes', async () => {
    const api = createTestApi();
    const paused = await api.settings.pause({ duration: PauseDuration.Days, amount: 7 });
    expect(paused.pause?.until).toBe('2026-10-27T06:00:00.000Z');
    expect((await api.settings.pause({ duration: PauseDuration.Months, amount: 1 })).pause?.until).toBe('2026-11-20T06:00:00.000Z');
    expect((await api.settings.pause({ duration: PauseDuration.Indefinite })).pause?.until).toBeUndefined();
    expect((await api.settings.resume()).pause).toBeUndefined();
    expect((await api.dashboard.getDashboard()).pause).toBeUndefined();
  });

  it('updates the submission window and schedules deletion after the grace period', async () => {
    const api = createTestApi();
    const settings = await api.settings.updateSubmissionWindow({ kind: SubmissionWindowKind.AsSoonAsReady });
    expect(settings.submissionWindow.kind).toBe(SubmissionWindowKind.AsSoonAsReady);
    expect((await api.settings.requestAccountDeletion()).scheduledFor).toBe('2026-11-03T06:00:00.000Z');
  });

  it('never leaks internal state through returned objects', async () => {
    const api = createTestApi();
    const profile = await api.profile.getProfile();
    profile.fullName = 'Changed';
    expect((await api.profile.getProfile()).fullName).not.toBe('Changed');
  });
});
