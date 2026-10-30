'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { CalendarCheck, CircleCheck, Mail, Plug, RefreshCw, TriangleAlert, Unplug } from 'lucide-react';
import type { IntegrationStatus } from '@careerpilot/api-client';
import {
  GOOGLE_RETURN_FLAG,
  GOOGLE_RETURN_REASON,
  connectionStatusKey,
  failureKey,
  needsReconnect,
  parseConnectReturn,
  useAuthorizeGoogle,
  useDisconnectGoogle,
  useFormat,
  useGoogleStatus,
  useSyncGoogle,
  useT,
} from '@careerpilot/client-core';
import { ConnectionStatus, StatusTone } from '@careerpilot/domain-ui-logic';
import { Badge, Banner, Button, Card, ConfirmDialog, ErrorState, LoadingState, PageHeader, useToast } from '@careerpilot/ui-web';
import { openAddress } from '@/core/open-address';

function AccessRow({ icon: Glyph, label, allowed }: { icon: typeof Mail; label: string; allowed: boolean }) {
  const t = useT();
  return (
    <li className="flex items-center gap-3">
      <Glyph className="size-5 shrink-0 text-muted" aria-hidden />
      <span className="flex-1">{label}</span>
      <Badge label={allowed ? t('integrations.page.accessOn') : t('integrations.page.accessOff')} tone={allowed ? StatusTone.Success : StatusTone.Neutral} />
    </li>
  );
}

function ReturnBanner() {
  const t = useT();
  const params = useSearchParams();
  const returned = parseConnectReturn(params.get(GOOGLE_RETURN_FLAG), params.get(GOOGLE_RETURN_REASON));
  if (!returned) {
    return null;
  }
  return returned.kind === 'connected' ? (
    <Banner tone={StatusTone.Success} icon={CircleCheck} title={t('integrations.banner.connected')} />
  ) : (
    <Banner tone={StatusTone.Danger} icon={TriangleAlert} title={t('integrations.banner.error', { reason: t(returned.reasonKey) })} />
  );
}

function GoogleCard({ status }: { status: IntegrationStatus }) {
  const t = useT();
  const format = useFormat();
  const toast = useToast();
  const authorize = useAuthorizeGoogle();
  const sync = useSyncGoogle();
  const disconnect = useDisconnectGoogle();
  const connection = status.connection;
  const reconnect = needsReconnect(status);
  const connect = () => authorize.mutate(undefined, { onSuccess: ({ url }) => openAddress(url), onError: () => toast.show({ message: t('integrations.page.connectFailed') }) });
  const checkNow = () =>
    sync.mutate(undefined, {
      onSuccess: (summary) => toast.show({ message: t('integrations.page.syncDone', { messages: summary.messages, events: summary.events }) }),
      onError: () => toast.show({ message: t('integrations.page.actionFailed') }),
    });
  return (
    <Card className="gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">{t('integrations.page.googleName')}</h2>
        <Badge label={t(connectionStatusKey(status))} tone={status.connected ? StatusTone.Success : reconnect ? StatusTone.Warning : StatusTone.Neutral} />
      </div>
      {connection ? (
        <div className="flex flex-col gap-1">
          <p className="font-medium">{t('integrations.page.connectedAs', { email: connection.email })}</p>
          <p className="text-sm text-muted">
            {connection.lastSyncAt ? t('integrations.page.lastSync', { time: format.dateTime(connection.lastSyncAt) }) : t('integrations.page.neverSynced')}
          </p>
        </div>
      ) : null}
      {connection?.lastError ? <Banner tone={StatusTone.Warning} icon={TriangleAlert} title={t(failureKey(connection.lastError))} /> : null}
      {status.configured ? null : <Banner tone={StatusTone.Info} icon={TriangleAlert} title={t('integrations.page.notConfigured')} />}
      <ul className="flex flex-col gap-2">
        <AccessRow icon={Mail} label={t('integrations.page.mailAccess')} allowed={status.mailAccess} />
        <AccessRow icon={CalendarCheck} label={t('integrations.page.calendarAccess')} allowed={status.calendarAccess} />
      </ul>
      <p className="text-sm text-muted">{t('integrations.page.readOnlyNote')}</p>
      <div className="flex flex-wrap gap-2">
        {connection?.status === ConnectionStatus.Connected ? (
          <>
            <Button icon={RefreshCw} onClick={checkNow} loading={sync.isPending}>
              {sync.isPending ? t('integrations.page.syncing') : t('integrations.page.syncNow')}
            </Button>
            <ConfirmDialog
              title={t('integrations.page.disconnectTitle')}
              body={t('integrations.page.disconnectBody')}
              confirmLabel={t('integrations.page.disconnectConfirm')}
              destructive
              onConfirm={() => disconnect.mutate(undefined, { onError: () => toast.show({ message: t('integrations.page.actionFailed') }) })}
              trigger={
                <Button variant="outline" icon={Unplug} loading={disconnect.isPending}>
                  {t('integrations.page.disconnect')}
                </Button>
              }
            />
          </>
        ) : (
          <Button icon={Plug} onClick={connect} loading={authorize.isPending} disabled={!status.configured}>
            {reconnect ? t('integrations.page.reconnect') : t('integrations.page.connect')}
          </Button>
        )}
      </div>
    </Card>
  );
}

function Content() {
  const t = useT();
  const status = useGoogleStatus();
  return (
    <>
      <PageHeader title={t('integrations.page.title')} description={t('integrations.page.intro')} />
      <ReturnBanner />
      {status.isPending ? <LoadingState /> : null}
      {status.isError ? <ErrorState onRetry={() => void status.refetch()} /> : null}
      {status.data ? <GoogleCard status={status.data} /> : null}
    </>
  );
}

export function ConnectedAccountsPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <Content />
    </Suspense>
  );
}
