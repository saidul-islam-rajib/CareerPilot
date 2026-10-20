import { useQuery } from '@tanstack/react-query';
import type { ApplicationFilter } from '@careerpilot/api-client';
import { queryKeys } from '@/core/query/query-keys';
import { useApi } from '@/core/services/app-services';

export function useApplications(filter: ApplicationFilter) {
  const api = useApi();
  return useQuery({ queryKey: queryKeys.applications(filter), queryFn: () => api.applications.listApplications(filter) });
}

export function useApplication(id: string) {
  const api = useApi();
  return useQuery({ queryKey: queryKeys.application(id), queryFn: () => api.applications.getApplication(id) });
}
