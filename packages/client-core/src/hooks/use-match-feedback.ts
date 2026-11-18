import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { MatchFeedback } from '@careerpilot/api-client';
import type { FeedbackReason, FeedbackVerdict } from '@careerpilot/domain-ui-logic';
import { queryKeys } from '../query/query-keys';
import { useApi } from '../services/app-services';

export function toggleReason(reasons: FeedbackReason[], reason: FeedbackReason): FeedbackReason[] {
  return reasons.includes(reason) ? reasons.filter((existing) => existing !== reason) : [...reasons, reason];
}

export function useMatchFeedback(opportunityId: string, current?: MatchFeedback) {
  const api = useApi();
  const client = useQueryClient();
  const [reasons, setReasons] = useState<FeedbackReason[] | undefined>();
  const refresh = async () => {
    setReasons(undefined);
    await Promise.all([
      client.invalidateQueries({ queryKey: queryKeys.opportunity(opportunityId) }),
      client.invalidateQueries({ queryKey: queryKeys.dashboard }),
    ]);
  };
  const give = useMutation({
    mutationFn: (verdict: FeedbackVerdict) => api.opportunities.giveFeedback(opportunityId, { verdict, reasons: reasons ?? current?.reasons ?? [] }),
    onSuccess: refresh,
  });
  const clear = useMutation({ mutationFn: () => api.opportunities.removeFeedback(opportunityId), onSuccess: refresh });
  const selected = reasons ?? current?.reasons ?? [];
  return {
    verdict: current?.verdict,
    reasons: selected,
    toggle: (reason: FeedbackReason) => setReasons(toggleReason(selected, reason)),
    give: (verdict: FeedbackVerdict) => give.mutate(verdict),
    clear: () => clear.mutate(),
    saving: give.isPending || clear.isPending,
    failed: give.isError || clear.isError,
  };
}
