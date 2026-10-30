'use client';

import { useQuery } from '@tanstack/react-query';
import { Plug } from 'lucide-react';
import { connectionStatusKey, failureKey, useFormat, useT } from '@careerpilot/client-core';
import { ConnectionStatus, StatusTone } from '@careerpilot/domain-ui-logic';
import { Badge, Card, EmptyState, ErrorState, LoadingState } from '@careerpilot/ui-web';
import { adminKeys } from '@/core/admin-queries';
import { useAdminApi } from '@/core/admin-services';

export function ConnectedAccountsCard({ userId }: { userId: string }) {
  const t = useT();
  const api = useAdminApi();
  const format = useFormat();
  const accounts = useQuery({ queryKey: [...adminKeys.user(userId), 'integrations'], queryFn: () => api.users.connectedAccounts(userId) });
  if (accounts.isPending) {
    return <LoadingState />;
  }
  if (accounts.isError) {
    return <ErrorState onRetry={() => void accounts.refetch()} />;
  }
  return (
    <section aria-labelledby="connected-accounts-title" className="flex flex-col gap-3">
      <h3 id="connected-accounts-title" className="text-lg font-semibold">
        {t('integrations.admin.title')}
      </h3>
      {accounts.data.length === 0 ? (
        <EmptyState body={t('integrations.admin.empty')} />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {accounts.data.map((account) => (
            <li key={`${account.provider}-${account.email}`}>
              <Card className="gap-2">
                <div className="flex items-center gap-2">
                  <Plug className="size-5 text-muted" aria-hidden />
                  <span className="font-semibold">{t('integrations.admin.provider')}</span>
                  <Badge
                    label={t(connectionStatusKey({ connected: account.status === ConnectionStatus.Connected, configured: true, connection: account, mailAccess: false, calendarAccess: false }))}
                    tone={account.status === ConnectionStatus.Connected ? StatusTone.Success : StatusTone.Warning}
                  />
                </div>
                <p className="break-all">{account.email}</p>
                <p className="text-sm text-muted">
                  {account.lastSyncAt ? t('integrations.page.lastSync', { time: format.dateTime(account.lastSyncAt) }) : t('integrations.page.neverSynced')}
                </p>
                {account.lastError ? <p className="text-sm text-danger">{t(failureKey(account.lastError))}</p> : null}
              </Card>
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-muted">{t('integrations.admin.note')}</p>
    </section>
  );
}
