import { describe, expect, it } from 'vitest';
import { DraftSource, DraftStatus, IssueKind, WritingKind } from '@careerpilot/domain-ui-logic';
import { ApiErrorCode, ApiErrorDetail } from '../errors';
import { createTestApi } from '../test-support';
import { HttpMethod, type HttpClient } from '../http/http-client';
import { createHttpWriting, draftQuery } from './http';

const OPPORTUNITY = 'opp_remote_frontend';
const APPROVAL = 'apr_frontend';
const OSLO_APPROVAL = 'apr_oslo';

describe('in-memory writing', () => {
  it('says AI is not configured and marks AI-only kinds unavailable', async () => {
    const { writing } = createTestApi();
    const status = await writing.status();
    expect(status.aiConfigured).toBe(false);
    expect(status.kinds.find((k) => k.kind === WritingKind.Essay)?.available).toBe(false);
    expect(status.kinds.find((k) => k.kind === WritingKind.CoverLetter)?.available).toBe(true);
    await expect(writing.generate({ kind: WritingKind.Essay, opportunityId: OPPORTUNITY })).rejects.toMatchObject({
      code: ApiErrorCode.ServiceUnavailable,
      detail: ApiErrorDetail.AiNotConfigured,
    });
  });

  it('writes a cover letter from profile facts and keeps numbered versions', async () => {
    const { writing } = createTestApi();
    const first = await writing.generate({ kind: WritingKind.CoverLetter, opportunityId: OPPORTUNITY });
    expect(first).toMatchObject({ version: 1, source: DraftSource.Template, status: DraftStatus.Ready });
    expect(first.text).toContain('Northwind Labs');
    const edited = await writing.editDraft(first.id, `${first.text}\n\nThank you.`);
    expect(edited).toMatchObject({ version: 2, source: DraftSource.User, parentId: first.id });
    const listed = await writing.listDrafts({ opportunityId: OPPORTUNITY, kind: WritingKind.CoverLetter });
    expect(listed.map((d) => d.version)).toEqual([2, 1]);
  });

  it('flags other employers and blocks attaching until fixed', async () => {
    const { writing, approvals } = createTestApi();
    const draft = await writing.generate({ kind: WritingKind.CoverLetter, opportunityId: OPPORTUNITY });
    const flagged = await writing.editDraft(draft.id, 'Dear Northwind Labs hiring team, I want to join.\n\nI also admire Kite Commerce.');
    expect(flagged.status).toBe(DraftStatus.NeedsFixes);
    expect(flagged.issues.some((i) => i.kind === IssueKind.OtherEmployer)).toBe(true);
    await expect(writing.attach(flagged.id, APPROVAL)).rejects.toMatchObject({ detail: ApiErrorDetail.HasIssues });
    const cleaned = await writing.stripFlagged(flagged.id);
    expect(cleaned.text).not.toContain('Kite Commerce');
    const before = (await approvals.getApproval(APPROVAL)).materials.coverLetter;
    expect(before).not.toBe(cleaned.text);
  });

  it('attaches exactly the shown text, replaces older versions, and detaches', async () => {
    const { writing, approvals } = createTestApi();
    const draft = await writing.generate({ kind: WritingKind.CoverLetter, opportunityId: OPPORTUNITY });
    const original = (await approvals.getApproval(APPROVAL)).materials.coverLetter;
    await writing.attach(draft.id, APPROVAL);
    let approval = await approvals.getApproval(APPROVAL);
    expect(approval.materials.coverLetter).toBe(draft.text);
    expect(approval.materials.writing).toEqual([
      { kind: WritingKind.CoverLetter, draftId: draft.id, version: 1, source: DraftSource.Template, text: draft.text },
    ]);
    await writing.detach(draft.id, APPROVAL);
    approval = await approvals.getApproval(APPROVAL);
    expect(approval.materials.writing).toEqual([]);
    expect(approval.materials.coverLetter).toBe(original);
  });

  it('refuses another opportunity and unknown drafts', async () => {
    const { writing } = createTestApi();
    const draft = await writing.generate({ kind: WritingKind.TailoredCv, opportunityId: OPPORTUNITY });
    await expect(writing.attach(draft.id, OSLO_APPROVAL)).rejects.toMatchObject({ detail: ApiErrorDetail.OpportunityMismatch });
    await expect(writing.getDraft('wrt_missing')).rejects.toMatchObject({ code: ApiErrorCode.NotFound });
  });

  it('removes a draft', async () => {
    const { writing } = createTestApi();
    const draft = await writing.generate({ kind: WritingKind.CoverLetter, opportunityId: OPPORTUNITY });
    await writing.removeDraft(draft.id);
    expect(await writing.listDrafts()).toEqual([]);
  });
});

describe('http writing', () => {
  it('builds the paths and bodies the backend expects', async () => {
    const calls: Array<[string, string, unknown]> = [];
    const http: HttpClient = {
      request: <T>(method: string, path: string, body?: unknown) => {
        calls.push([method, path, body]);
        return Promise.resolve(undefined as T);
      },
    };
    const api = createHttpWriting(http);
    await api.listDrafts({ opportunityId: 'opp 1', kind: WritingKind.Essay });
    await api.generate({ kind: WritingKind.CoverLetter, opportunityId: OPPORTUNITY });
    await api.editDraft('wrt_1', 'text');
    await api.attach('wrt_1', APPROVAL);
    await api.removeDraft('wrt_1');
    expect(calls).toEqual([
      [HttpMethod.Get, '/v1/writing/drafts?opportunityId=opp+1&kind=essay', undefined],
      [HttpMethod.Post, '/v1/writing/drafts', { kind: WritingKind.CoverLetter, opportunityId: OPPORTUNITY }],
      [HttpMethod.Put, '/v1/writing/drafts/wrt_1', { text: 'text' }],
      [HttpMethod.Post, '/v1/writing/drafts/wrt_1/attach', { approvalId: APPROVAL }],
      [HttpMethod.Delete, '/v1/writing/drafts/wrt_1', undefined],
    ]);
    expect(draftQuery()).toBe('');
  });
});
