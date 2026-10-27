'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import type { AdminSession } from '@careerpilot/api-client';
import { useChoosePasswordForm } from '@careerpilot/client-core';
import { adminKeys } from '@/core/admin-queries';
import { useAdminApi } from '@/core/admin-services';
import { useAdminSession } from '@/core/admin-session';

export function useAdminLink(token: string) {
  const api = useAdminApi();
  return useQuery({
    queryKey: adminKeys.link(token),
    queryFn: () => api.auth.inspectAccountLink(token),
    enabled: token.length > 0,
    retry: false,
    gcTime: 0,
  });
}

export function useAdminPasswordForm(token: string) {
  const api = useAdminApi();
  const session = useAdminSession();
  return useChoosePasswordForm<AdminSession>((password) => api.auth.completeAccountLink({ token, password }), session.start);
}

export function usePasswordLinkRequest() {
  const api = useAdminApi();
  return useMutation({ mutationFn: (email: string) => api.auth.requestPasswordLink({ email }) });
}
