import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/core/query/query-keys';
import { useApi } from '@/core/services/app-services';

export function useDashboard() {
  const api = useApi();
  return useQuery({ queryKey: queryKeys.dashboard, queryFn: () => api.dashboard.getDashboard() });
}

export function useResume() {
  const api = useApi();
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => api.settings.resume(),
    onSuccess: async () => {
      await Promise.all([client.invalidateQueries({ queryKey: queryKeys.dashboard }), client.invalidateQueries({ queryKey: queryKeys.settings })]);
    },
  });
}
