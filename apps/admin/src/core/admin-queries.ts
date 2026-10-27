'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { PageQuery } from '@careerpilot/api-client';
import { useAdminApi } from './admin-services';

export const adminKeys = {
  all: ['admin'] as const,
  dashboard: ['admin', 'dashboard'] as const,
  list: (resource: string, query: PageQuery) => ['admin', resource, query] as const,
  resource: (resource: string) => ['admin', resource] as const,
  user: (id: string) => ['admin', 'user', id] as const,
  settings: ['admin', 'settings'] as const,
  admins: ['admin', 'admins'] as const,
  link: (token: string) => ['admin', 'link', token] as const,
};

export function useAdminMutation<TArgs, TResult>(run: (args: TArgs) => Promise<TResult>) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: run,
    onSuccess: () => client.invalidateQueries({ queryKey: adminKeys.all }),
  });
}

export function useDashboard() {
  const api = useAdminApi();
  return useQuery({ queryKey: adminKeys.dashboard, queryFn: () => api.dashboard.getDashboard() });
}

export function usePagedList<T>(resource: string, query: PageQuery, fetcher: (query: PageQuery) => Promise<T>) {
  return useQuery({ queryKey: adminKeys.list(resource, query), queryFn: () => fetcher(query), placeholderData: (previous) => previous });
}
