import { describe, expect, it } from 'vitest';
import { catalogs, createTranslator } from '@careerpilot/i18n';
import { ApiError, ApiErrorCode, ApiErrorDetail, type CheckIssue, type WritingDraft } from '@careerpilot/api-client';
import { DraftSource, DraftStatus, IssueKind, WritingKind, WritingTone } from '@careerpilot/domain-ui-logic';
import { issueMessage, latestPerKind, sourceLabel, versionsOf, writingErrorKey } from './use-writing';

const t = createTranslator(catalogs.en);

function draft(kind: WritingKind, version: number): WritingDraft {
  return {
    id: `wrt_${kind}_${version}`,
    kind,
    opportunityId: 'opp_1',
    organization: 'Northwind Labs',
    title: 'Engineer',
    version,
    text: 'text',
    source: DraftSource.Template,
    tone: WritingTone.Professional,
    instructions: '',
    status: DraftStatus.Ready,
    issues: [],
    factsUsed: [],
    wordCount: 1,
    createdAt: '2026-11-04T06:00:00.000Z',
    attachedApprovalIds: [],
  };
}

describe('writing helpers', () => {
  it('has a message for every issue kind and every error detail', () => {
    for (const kind of Object.values(IssueKind)) {
      const issue: CheckIssue = { kind, text: 'A sentence.', terms: ['x', '10'] };
      expect(issueMessage(t, issue)).not.toContain('writing.issues');
    }
    for (const detail of [
      ApiErrorDetail.AiNotConfigured,
      ApiErrorDetail.AiUnavailable,
      ApiErrorDetail.AiRefused,
      ApiErrorDetail.HasIssues,
      ApiErrorDetail.ApprovalClosed,
      ApiErrorDetail.OpportunityMismatch,
      ApiErrorDetail.VersionLimit,
      ApiErrorDetail.NothingToWrite,
      ApiErrorDetail.WritingText,
      ApiErrorDetail.WritingInstructions,
    ]) {
      const key = writingErrorKey(new ApiError(ApiErrorCode.Validation, undefined, detail));
      expect(t(key)).not.toBe(key);
    }
    expect(writingErrorKey(new Error('x'))).toBe('writing.errors.generic');
  });

  it('writes the over-limit and claim messages with their numbers and terms', () => {
    expect(issueMessage(t, { kind: IssueKind.OverLimit, terms: ['500', '450'] })).toBe('500 words (limit 450)');
    expect(issueMessage(t, { kind: IssueKind.UnsupportedClaim, text: 'I led 12.', terms: ['12'] })).toBe(
      'Not supported by your profile (12): I led 12.',
    );
    expect(issueMessage(t, { kind: IssueKind.MissingTarget, terms: ['Northwind Labs'] })).toBe('Does not mention Northwind Labs');
  });

  it('labels the source and groups versions', () => {
    expect(sourceLabel(t, { source: DraftSource.Ai, model: 'claude-sonnet-5-5' })).toBe('AI (claude-sonnet-5-5)');
    expect(sourceLabel(t, { source: DraftSource.Template })).toBe('Template from your profile facts');
    const drafts = [draft(WritingKind.CoverLetter, 1), draft(WritingKind.CoverLetter, 3), draft(WritingKind.TailoredCv, 1)];
    expect(latestPerKind(drafts).get(WritingKind.CoverLetter)?.version).toBe(3);
    expect(versionsOf(drafts, WritingKind.CoverLetter).map((d) => d.version)).toEqual([3, 1]);
  });
});
