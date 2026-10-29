'use client';

import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { KeyRound, Mail, Phone } from 'lucide-react';
import { useFormat, useT } from '@careerpilot/client-core';
import { AdminArea, EnumKey, PermissionAction, UserAccountStatus } from '@careerpilot/domain-ui-logic';
import { Button, Card, ConfirmDialog, EnumBadge, ErrorState, ListRow, LoadingState, PageHeader, Section } from '@careerpilot/ui-web';
import { adminKeys, useAdminMutation } from '@/core/admin-queries';
import { useAdminApi } from '@/core/admin-services';
import { useCan } from '@/core/admin-session';
import { UserRecordTabs } from './user-record';

export function UserPage() {
  const { id } = useParams<{ id: string }>();
  const t = useT();
  const api = useAdminApi();
  const format = useFormat();
  const canUpdate = useCan(AdminArea.Users, PermissionAction.Update);
  const user = useQuery({ queryKey: adminKeys.user(id), queryFn: () => api.users.getUser(id) });
  const suspend = useAdminMutation(() => api.users.suspendUser(id, t('admin.users.suspendReason')));
  const reactivate = useAdminMutation(() => api.users.reactivateUser(id));
  const pause = useAdminMutation(() => api.users.pauseAutomation(id));

  if (user.isPending) {
    return <LoadingState />;
  }
  if (user.isError) {
    return <ErrorState onRetry={() => void user.refetch()} />;
  }
  const u = user.data;

  return (
    <>
      <PageHeader
        title={u.fullName}
        description={`${u.email} · ${u.country}`}
        actions={
          canUpdate ? (
            <div className="flex flex-wrap gap-2">
              {u.status === UserAccountStatus.Suspended ? (
                <Button variant="outline" onClick={() => reactivate.mutate(undefined)} loading={reactivate.isPending}>
                  {t('admin.users.reactivate')}
                </Button>
              ) : (
                <>
                  <Button variant="outline" onClick={() => pause.mutate(undefined)} loading={pause.isPending} disabled={u.status === UserAccountStatus.Paused}>
                    {t('admin.users.pauseAutomation')}
                  </Button>
                  <ConfirmDialog
                    title={t('admin.users.confirmSuspend')}
                    body={t('admin.users.confirmSuspendBody', { name: u.fullName })}
                    confirmLabel={t('admin.users.suspend')}
                    destructive
                    onConfirm={() => suspend.mutate(undefined)}
                    trigger={
                      <Button variant="destructive" loading={suspend.isPending}>
                        {t('admin.users.suspend')}
                      </Button>
                    }
                  />
                </>
              )}
            </div>
          ) : null
        }
      />
      <div className="flex flex-wrap gap-2">
        <EnumBadge enumKey={EnumKey.UserAccountStatus} value={u.status} />
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <Section title={t('admin.users.contact')}>
          <Card>
            <ListRow icon={Mail} title={u.email} />
            {u.phone ? <ListRow icon={Phone} title={u.phone} /> : null}
            <p className="text-sm text-muted">
              {t('admin.columns.joined')}: {format.date(u.createdAt)} · {t('admin.columns.completeness')}: {u.profileCompleteness}%
            </p>
          </Card>
        </Section>
        <Section title={t('admin.users.secrets')}>
          <Card>
            <p className="text-sm text-muted">{t('admin.users.secretNote')}</p>
            {u.secrets.map((secret) => (
              <ListRow key={secret.label} icon={KeyRound} title={secret.label} subtitle={secret.lastUsedAt ? t('admin.users.lastUsed', { date: format.dateTime(secret.lastUsedAt) }) : undefined} />
            ))}
          </Card>
        </Section>
      </div>
      <UserRecordTabs userId={id} />
    </>
  );
}
