'use client';

import { MonitorSmartphone, ShieldAlert } from 'lucide-react';
import { useFormat, useSignInActivity, useT } from '@careerpilot/client-core';
import { StatusTone } from '@careerpilot/domain-ui-logic';
import { Badge, Card, ErrorState, ListRow, LoadingState, PageHeader } from '@careerpilot/ui-web';

export function ActivityPage() {
  const t = useT();
  const format = useFormat();
  const activity = useSignInActivity();
  return (
    <>
      <PageHeader title={t('activity.title')} description={t('auth.consentNote')} />
      {activity.isPending ? <LoadingState /> : null}
      {activity.isError ? <ErrorState onRetry={() => void activity.refetch()} /> : null}
      <div className="flex flex-col gap-3">
        {activity.data?.map((event) => (
          <Card key={event.id}>
            <ListRow
              icon={event.success ? MonitorSmartphone : ShieldAlert}
              title={event.device}
              subtitle={`${event.approximateLocation} · ${event.ip} · ${format.dateTime(event.at)}`}
              trailing={
                event.current ? (
                  <Badge label={t('activity.thisDevice')} tone={StatusTone.Primary} />
                ) : (
                  <Badge label={event.success ? t('activity.success') : t('activity.failed')} tone={event.success ? StatusTone.Success : StatusTone.Danger} />
                )
              }
            />
          </Card>
        ))}
      </div>
    </>
  );
}
