import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiErrorDetail, isApiError, type CheckIssue, type GenerateInput, type WritingDraft } from '@careerpilot/api-client';
import { DraftSource, IssueKind, WritingKind } from '@careerpilot/domain-ui-logic';
import type { Translate } from '@careerpilot/i18n';
import { queryKeys } from '../query/query-keys';
import { useApi } from '../services/app-services';

const ERROR_KEYS: Readonly<Record<string, string>> = {
  [ApiErrorDetail.AiNotConfigured]: 'writing.errors.ai_not_configured',
  [ApiErrorDetail.AiUnavailable]: 'writing.errors.ai_unavailable',
  [ApiErrorDetail.AiRefused]: 'writing.errors.ai_refused',
  [ApiErrorDetail.HasIssues]: 'writing.errors.has_issues',
  [ApiErrorDetail.ApprovalClosed]: 'writing.errors.approval_closed',
  [ApiErrorDetail.OpportunityMismatch]: 'writing.errors.opportunity_mismatch',
  [ApiErrorDetail.VersionLimit]: 'writing.errors.version_limit',
  [ApiErrorDetail.NothingToWrite]: 'writing.errors.nothing_to_write',
  [ApiErrorDetail.WritingText]: 'writing.errors.text',
  [ApiErrorDetail.WritingInstructions]: 'writing.errors.instructions',
};
const GENERIC_ERROR_KEY = 'writing.errors.generic';
export const KIND_ORDER: readonly WritingKind[] = [WritingKind.CoverLetter, WritingKind.TailoredCv, WritingKind.Essay, WritingKind.Statement];

export function writingErrorKey(error: unknown): string {
  return (isApiError(error) && ERROR_KEYS[error.detail ?? '']) || GENERIC_ERROR_KEY;
}

export function issueMessage(t: Translate, issue: CheckIssue): string {
  const [first = '', second = ''] = issue.terms ?? [];
  const terms = issue.kind === IssueKind.OverLimit ? first : (issue.terms ?? []).join(', ');
  const message = t(`writing.issues.${issue.kind}`, { terms, text: issue.text ?? '', limit: second });
  return issue.text ? message : message.replace(/:\s*$/, '');
}

export function sourceLabel(t: Translate, draft: Pick<WritingDraft, 'source' | 'model'>): string {
  return t(`writing.sources.${draft.source}`, { model: draft.model ?? '' });
}

export function isAiSource(draft: Pick<WritingDraft, 'source'>): boolean {
  return draft.source === DraftSource.Ai;
}

export function latestPerKind(drafts: WritingDraft[]): Map<WritingKind, WritingDraft> {
  const latest = new Map<WritingKind, WritingDraft>();
  for (const draft of drafts) {
    const current = latest.get(draft.kind);
    if (!current || draft.version > current.version) {
      latest.set(draft.kind, draft);
    }
  }
  return latest;
}

export function versionsOf(drafts: WritingDraft[], kind: WritingKind): WritingDraft[] {
  return drafts.filter((draft) => draft.kind === kind).sort((a, b) => b.version - a.version);
}

export function useWritingStatus() {
  const api = useApi();
  return useQuery({ queryKey: queryKeys.writingStatus, queryFn: () => api.writing.status() });
}

export function useDrafts(opportunityId: string) {
  const api = useApi();
  return useQuery({ queryKey: queryKeys.writingDrafts(opportunityId), queryFn: () => api.writing.listDrafts({ opportunityId }) });
}

function useDraftMutation<TArgs, TResult>(opportunityId: string, run: (args: TArgs) => Promise<TResult>) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: run,
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: queryKeys.writingDrafts(opportunityId) }),
        client.invalidateQueries({ queryKey: queryKeys.approvals }),
        client.invalidateQueries({ predicate: (query) => query.queryKey[0] === 'approval' }),
      ]);
    },
  });
}

export function useWritingActions(opportunityId: string) {
  const api = useApi();
  return {
    generate: useDraftMutation(opportunityId, (input: Omit<GenerateInput, 'opportunityId'>) => api.writing.generate({ ...input, opportunityId })),
    edit: useDraftMutation(opportunityId, ({ id, text }: { id: string; text: string }) => api.writing.editDraft(id, text)),
    remove: useDraftMutation(opportunityId, (id: string) => api.writing.removeDraft(id)),
    recheck: useDraftMutation(opportunityId, (id: string) => api.writing.recheck(id)),
    stripFlagged: useDraftMutation(opportunityId, (id: string) => api.writing.stripFlagged(id)),
    attach: useDraftMutation(opportunityId, ({ id, approvalId }: { id: string; approvalId: string }) => api.writing.attach(id, approvalId)),
    detach: useDraftMutation(opportunityId, ({ id, approvalId }: { id: string; approvalId: string }) => api.writing.detach(id, approvalId)),
  };
}
