'use client';

import { useQuery } from '@tanstack/react-query';
import { useFormat, useT } from '@careerpilot/client-core';
import { Card, EmptyState, ErrorState, LoadingState } from '@careerpilot/ui-web';
import { adminKeys } from '@/core/admin-queries';
import { useAdminApi } from '@/core/admin-services';

export function ConsentHistoryCard({ userId }: { userId: string }) {
  const t = useT();
  const api = useAdminApi();
  const format = useFormat();
  const consents = useQuery({ queryKey: [...adminKeys.user(userId), 'consents'], queryFn: () => api.privacy.userConsents(userId) });
  if (consents.isPending) {
    return <LoadingState />;
  }
  if (consents.isError) {
    return <ErrorState onRetry={() => void consents.refetch()} />;
  }
  return (
    <section aria-labelledby="consent-history-title" className="flex flex-col gap-3">
      <h3 id="consent-history-title" className="text-lg font-semibold">
        {t('privacy.admin.consents')}
      </h3>
      {consents.data.history.length === 0 ? (
        <EmptyState body={t('privacy.admin.empty')} />
      ) : (
        <Card className="gap-2">
          {consents.data.history.map((record) => (
            <p key={record.id} className="text-sm">
              <span className="font-semibold">{t(`privacy.consent.kind.${record.kind}`)}</span>{' '}
              {t('privacy.consent.historyLine', {
                state: record.granted ? t('privacy.consent.stateGranted') : t('privacy.consent.stateWithdrawn'),
                date: format.dateTime(record.at),
                version: record.version,
              })}
            </p>
          ))}
        </Card>
      )}
    </section>
  );
}
