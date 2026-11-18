import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { BulkApprovalRow } from '@careerpilot/api-client';
import { queryKeys } from '../query/query-keys';
import { useApi } from '../services/app-services';

export function eligibleIds(rows: BulkApprovalRow[]): string[] {
  return rows.filter((row) => row.eligible).map((row) => row.approvalId);
}

export function useBulkApprovals() {
  const api = useApi();
  const client = useQueryClient();
  const rows = useQuery({ queryKey: queryKeys.bulkApprovals, queryFn: () => api.approvals.bulkRows() });
  const [selected, setSelected] = useState<string[]>([]);
  const items = rows.data ?? [];
  const chosen = items.filter((row) => row.eligible && selected.includes(row.approvalId));
  const approve = useMutation({
    mutationFn: () => api.approvals.bulkApprove(chosen.map((row) => ({ approvalId: row.approvalId, reviewToken: row.reviewToken }))),
    onSuccess: async () => {
      setSelected([]);
      await Promise.all([
        client.invalidateQueries({ queryKey: queryKeys.bulkApprovals }),
        client.invalidateQueries({ queryKey: queryKeys.approvals }),
        client.invalidateQueries({ queryKey: queryKeys.dashboard }),
        client.invalidateQueries({ queryKey: queryKeys.applicationsAll }),
      ]);
    },
  });
  return {
    rows,
    items,
    selected: chosen.map((row) => row.approvalId),
    toggle: (id: string) => setSelected((current) => (current.includes(id) ? current.filter((existing) => existing !== id) : [...current, id])),
    selectAll: () => setSelected(eligibleIds(items)),
    clear: () => setSelected([]),
    approve: () => approve.mutate(),
    approving: approve.isPending,
    result: approve.data,
    failed: approve.isError,
  };
}
