'use client';

import { useQuery } from '@tanstack/react-query';
import type { AdminAccount } from '@careerpilot/api-client';
import { useEnumDisplay, useFormat, useT } from '@careerpilot/client-core';
import { AdminArea, AdminRole, EnumKey, PermissionAction, StatusTone, enumValues } from '@careerpilot/domain-ui-logic';
import { Badge, Button, DataTable, EnumBadge, ErrorState, LoadingState, PageHeader } from '@careerpilot/ui-web';
import { adminKeys, useAdminMutation } from '@/core/admin-queries';
import { useAdminApi } from '@/core/admin-services';
import { useAdminSession, useCan } from '@/core/admin-session';

export function AdminsPage() {
  const t = useT();
  const api = useAdminApi();
  const format = useFormat();
  const display = useEnumDisplay();
  const { admin } = useAdminSession();
  const canUpdate = useCan(AdminArea.Admins, PermissionAction.Update);
  const admins = useQuery({ queryKey: adminKeys.admins, queryFn: () => api.admins.listAdmins() });
  const setRole = useAdminMutation(({ id, role }: { id: string; role: AdminRole }) => api.admins.setRole(id, role));
  const setSuspended = useAdminMutation(({ id, suspended }: { id: string; suspended: boolean }) => api.admins.setSuspended(id, suspended));

  if (admins.isPending) {
    return <LoadingState />;
  }
  if (admins.isError) {
    return <ErrorState onRetry={() => void admins.refetch()} />;
  }

  return (
    <>
      <PageHeader title={t('admin.admins.title')} />
      <DataTable<AdminAccount>
        caption={t('admin.admins.title')}
        rows={admins.data}
        rowKey={(a) => a.id}
        columns={[
          {
            key: 'name',
            header: t('admin.columns.name'),
            cell: (a) => (
              <span className="flex flex-col">
                <span className="flex items-center gap-2 font-semibold">
                  {a.fullName}
                  {a.id === admin?.id ? <Badge label={t('admin.admins.you')} tone={StatusTone.Primary} /> : null}
                </span>
                <span className="text-xs text-muted">{a.email}</span>
              </span>
            ),
          },
          {
            key: 'role',
            header: t('admin.columns.role'),
            cell: (a) =>
              canUpdate && a.id !== admin?.id ? (
                <select
                  aria-label={`${t('admin.columns.role')}: ${a.fullName}`}
                  value={a.role}
                  onChange={(e) => setRole.mutate({ id: a.id, role: e.target.value as AdminRole })}
                  className="min-h-9 rounded-control border border-input bg-background px-2 text-sm"
                >
                  {enumValues(AdminRole).map((role) => (
                    <option key={role} value={role}>
                      {display(EnumKey.AdminRole, role).label}
                    </option>
                  ))}
                </select>
              ) : (
                <EnumBadge enumKey={EnumKey.AdminRole} value={a.role} />
              ),
          },
          { key: 'mfa', header: t('admin.columns.mfa'), cell: (a) => <Badge label={a.mfaEnabled ? t('admin.admins.mfaOn') : t('admin.admins.mfaOff')} tone={a.mfaEnabled ? StatusTone.Success : StatusTone.Warning} /> },
          { key: 'lastSignIn', header: t('admin.columns.lastSignIn'), cell: (a) => (a.lastSignInAt ? format.dateTime(a.lastSignInAt) : '') },
          {
            key: 'actions',
            header: t('admin.actions'),
            cell: (a) =>
              canUpdate && a.id !== admin?.id ? (
                <Button size="sm" variant={a.suspended ? 'outline' : 'destructive'} onClick={() => setSuspended.mutate({ id: a.id, suspended: !a.suspended })}>
                  {a.suspended ? t('admin.admins.reactivate') : t('admin.admins.suspend')}
                </Button>
              ) : null,
          },
        ]}
      />
    </>
  );
}
