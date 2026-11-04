'use client';

import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useT } from '@careerpilot/client-core';
import { AdminArea, PermissionAction } from '@careerpilot/domain-ui-logic';
import { useToast } from '@careerpilot/ui-web';
import { adminKeys } from '@/core/admin-queries';
import { useAdminApi, useAdminServices } from '@/core/admin-services';
import { useCan } from '@/core/admin-session';

const MILLISECONDS_PER_SECOND = 1000;
const NO_UNREAD = 0;

export function useTeamUnread(): number {
  const t = useT();
  const api = useAdminApi();
  const toast = useToast();
  const { config } = useAdminServices();
  const allowed = useCan(AdminArea.Users, PermissionAction.Read);
  const unread = useQuery({
    queryKey: adminKeys.teamUnread,
    queryFn: () => api.messages.unread(),
    enabled: allowed,
    refetchInterval: config.messaging.pollSeconds * MILLISECONDS_PER_SECOND,
  });
  const count = unread.data?.count ?? NO_UNREAD;
  const previous = useRef<number | undefined>(undefined);
  const baseTitle = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (unread.data === undefined) {
      return;
    }
    if (previous.current !== undefined && count > previous.current) {
      toast.show({ message: t('admin.inbox.newMessage') });
    }
    previous.current = count;
  }, [count, unread.data, toast, t]);

  useEffect(() => {
    baseTitle.current ??= document.title;
    const base = baseTitle.current;
    document.title = count > NO_UNREAD ? t('admin.inbox.tabTitle', { count, title: base }) : base;
    return () => {
      document.title = base;
    };
  }, [count, t]);

  return count;
}
