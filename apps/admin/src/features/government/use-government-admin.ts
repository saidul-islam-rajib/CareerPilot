'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CircularContent, CircularNotice } from '@careerpilot/api-client';
import { useAdminApi } from '@/core/admin-services';

const KEY = ['admin', 'government'] as const;
const keys = { circulars: [...KEY, 'circulars'] as const, holidays: [...KEY, 'holidays'] as const, reference: [...KEY, 'reference'] as const };

export function useAdminCirculars() {
  const api = useAdminApi();
  return useQuery({ queryKey: keys.circulars, queryFn: () => api.government.listCirculars() });
}

export function useAdminHolidays() {
  const api = useAdminApi();
  return useQuery({ queryKey: keys.holidays, queryFn: () => api.government.listHolidays() });
}

export function useAdminGovernmentReference() {
  const api = useAdminApi();
  return useQuery({ queryKey: keys.reference, queryFn: () => api.government.reference() });
}

export function useCircularActions() {
  const api = useAdminApi();
  const client = useQueryClient();
  const refresh = () => client.invalidateQueries({ queryKey: KEY });
  const options = { onSuccess: refresh };
  return {
    create: useMutation({ mutationFn: (content: CircularContent) => api.government.createCircular(content), ...options }),
    update: useMutation({ mutationFn: (input: { id: string; content: CircularContent }) => api.government.updateCircular(input.id, input.content), ...options }),
    publish: useMutation({ mutationFn: (id: string) => api.government.publishCircular(id), ...options }),
    withdraw: useMutation({ mutationFn: (id: string) => api.government.withdrawCircular(id), ...options }),
    liveRemoved: useMutation({ mutationFn: (input: { id: string; removed: boolean }) => api.government.setLiveRemoved(input.id, input.removed), ...options }),
    addNotice: useMutation({ mutationFn: (input: { id: string; notice: Omit<CircularNotice, 'id'> }) => api.government.addNotice(input.id, input.notice), ...options }),
    remove: useMutation({ mutationFn: (id: string) => api.government.removeCircular(id), ...options }),
    importLink: useMutation({ mutationFn: (url: string) => api.government.importFromLink(url) }),
    addHoliday: useMutation({ mutationFn: (input: { on: string; name: string }) => api.government.addHoliday(input.on, input.name), ...options }),
    removeHoliday: useMutation({ mutationFn: (id: string) => api.government.removeHoliday(id), ...options }),
  };
}
