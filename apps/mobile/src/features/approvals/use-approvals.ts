import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ApprovalDetail } from '@careerpilot/api-client';
import { queryKeys } from '@/core/query/query-keys';
import { useApi } from '@/core/services/app-services';

export function useApprovals() {
  const api = useApi();
  return useQuery({ queryKey: queryKeys.approvals, queryFn: () => api.approvals.listApprovals() });
}

export function useApproval(id: string) {
  const api = useApi();
  return useQuery({ queryKey: queryKeys.approval(id), queryFn: () => api.approvals.getApproval(id) });
}

function useApprovalMutation<TArgs>(id: string, run: (args: TArgs) => Promise<ApprovalDetail>) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: run,
    onSuccess: async (detail) => {
      client.setQueryData(queryKeys.approval(id), detail);
      await Promise.all([
        client.invalidateQueries({ queryKey: queryKeys.approvals }),
        client.invalidateQueries({ queryKey: queryKeys.dashboard }),
        client.invalidateQueries({ queryKey: queryKeys.applicationsAll }),
      ]);
    },
  });
}

export function useApprovalActions(id: string) {
  const api = useApi();
  return {
    updateAnswer: useApprovalMutation(id, ({ answerId, answer }: { answerId: string; answer: string }) => api.approvals.updateAnswer(id, answerId, answer)),
    approve: useApprovalMutation(id, () => api.approvals.approve(id)),
    reject: useApprovalMutation(id, () => api.approvals.reject(id)),
  };
}
