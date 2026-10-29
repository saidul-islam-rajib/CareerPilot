'use client';

import { useRouter } from 'next/navigation';
import type { AdminUserRow } from '@careerpilot/api-client';
import { useFormat, useT } from '@careerpilot/client-core';
import { EnumKey, UserAccountStatus, enumValues } from '@careerpilot/domain-ui-logic';
import { EnumBadge, cn } from '@careerpilot/ui-web';
import { useAdminApi } from '@/core/admin-services';
import { AdminRoutes } from '@/core/routes';
import { ListPage } from '@/features/common/list-page';

export function UsersPage() {
  const t = useT();
  const api = useAdminApi();
  const router = useRouter();
  const format = useFormat();
  return (
    <ListPage<AdminUserRow>
      title={t('admin.users.title')}
      resource="users"
      fetcher={(query) => api.users.listUsers(query)}
      rowKey={(u) => u.id}
      statusEnum={{ key: EnumKey.UserAccountStatus, values: enumValues(UserAccountStatus) }}
      onRowClick={(u) => router.push(AdminRoutes.user(u.id))}
      columns={[
        {
          key: 'name',
          header: t('admin.columns.name'),
          cell: (u) => (
            <a href={AdminRoutes.user(u.id)} className="flex flex-col">
              <span className="font-semibold text-foreground">{u.fullName}</span>
              <span className="text-xs text-muted">{u.email}</span>
            </a>
          ),
        },
        { key: 'status', header: t('admin.columns.status'), cell: (u) => <EnumBadge enumKey={EnumKey.UserAccountStatus} value={u.status} /> },
        {
          key: 'presence',
          header: t('admin.columns.presence'),
          cell: (u) => (
            <span className="inline-flex items-center gap-2 whitespace-nowrap">
              <span aria-hidden className={cn('size-2.5 rounded-full', u.presence.online ? 'bg-success' : 'bg-border')} />
              {u.presence.online ? t('admin.presence.online') : u.presence.lastSeenAt ? format.ago(u.presence.lastSeenAt) : t('admin.presence.never')}
            </span>
          ),
        },
        { key: 'timeInApp', header: t('admin.columns.timeInApp'), cell: (u) => (u.presence.sessionsCount ? format.duration(u.presence.activeSeconds) : ''), className: 'tabular-nums' },
        { key: 'location', header: t('admin.columns.location'), cell: (u) => u.presence.location },
        { key: 'country', header: t('admin.columns.country'), cell: (u) => u.country },
        { key: 'applications', header: t('admin.columns.applications'), cell: (u) => u.applicationsCount, className: 'text-right tabular-nums' },
        { key: 'completeness', header: t('admin.columns.completeness'), cell: (u) => `${u.profileCompleteness}%`, className: 'text-right tabular-nums' },
        { key: 'automatic', header: t('admin.columns.automatic'), cell: (u) => (u.automaticEnabled ? t('common.on') : t('common.off')) },
        { key: 'lastSignIn', header: t('admin.columns.lastSignIn'), cell: (u) => (u.lastSignInAt ? format.date(u.lastSignInAt) : '') },
      ]}
    />
  );
}
