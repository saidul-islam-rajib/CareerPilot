'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useFormat, useT } from '@careerpilot/client-core';
import { ExportStatus, StatusTone } from '@careerpilot/domain-ui-logic';
import { Badge, Card, EmptyState, ErrorState, LoadingState, PageHeader } from '@careerpilot/ui-web';
import { useAdminApi } from '@/core/admin-services';
import { AdminRoutes } from '@/core/routes';

const KEYS = { exports: ['privacy', 'exports'] as const, deletions: ['privacy', 'deletions'] as const };

export function PrivacyRequestsPage() {
  const t = useT();
  const api = useAdminApi();
  const format = useFormat();
  const exports = useQuery({ queryKey: KEYS.exports, queryFn: () => api.privacy.exports() });
  const deletions = useQuery({ queryKey: KEYS.deletions, queryFn: () => api.privacy.deletions() });
  if (exports.isPending || deletions.isPending) {
    return <LoadingState />;
  }
  if (exports.isError || deletions.isError) {
    return <ErrorState onRetry={() => void Promise.all([exports.refetch(), deletions.refetch()])} />;
  }
  return (
    <>
      <PageHeader title={t('privacy.admin.title')} />
      <h2 className="text-lg font-semibold">{t('privacy.admin.deletions')}</h2>
      {deletions.data.length === 0 ? <EmptyState body={t('privacy.admin.empty')} /> : null}
      <div className="grid gap-3 md:grid-cols-2">
        {deletions.data.map((item) => (
          <Card key={item.id} className="gap-1">
            <div className="flex items-center justify-between gap-2">
              <Link className="font-semibold text-primary underline" href={AdminRoutes.user(item.userId)}>
                {t('privacy.admin.user', { id: item.userId })}
              </Link>
              <Badge label={t(`privacy.admin.deletionStatus.${item.status}`)} tone={StatusTone.Neutral} />
            </div>
            <p className="text-sm text-muted">{t('privacy.admin.requested', { date: format.dateTime(item.requestedAt) })}</p>
            <p className="text-sm text-muted">{t('privacy.admin.scheduled', { date: format.dateTime(item.scheduledFor) })}</p>
            {item.completedAt ? <p className="text-sm text-muted">{t('privacy.admin.completed', { date: format.dateTime(item.completedAt) })}</p> : null}
            {item.cancelledAt ? <p className="text-sm text-muted">{t('privacy.admin.cancelled', { date: format.dateTime(item.cancelledAt) })}</p> : null}
          </Card>
        ))}
      </div>
      <h2 className="text-lg font-semibold">{t('privacy.admin.exports')}</h2>
      {exports.data.length === 0 ? <EmptyState body={t('privacy.admin.empty')} /> : null}
      <div className="grid gap-3 md:grid-cols-2">
        {exports.data.map((item) => (
          <Card key={item.id} className="gap-1">
            <div className="flex items-center justify-between gap-2">
              <Link className="font-semibold text-primary underline" href={AdminRoutes.user(item.userId)}>
                {t('privacy.admin.user', { id: item.userId })}
              </Link>
              <Badge
                label={t(`privacy.exports.status.${item.status}`)}
                tone={item.status === ExportStatus.Ready ? StatusTone.Success : item.status === ExportStatus.Failed ? StatusTone.Danger : StatusTone.Neutral}
              />
            </div>
            <p>
              {t(`privacy.exports.kind.${item.kind}`)} ({item.format.toUpperCase()})
            </p>
            <p className="text-sm text-muted">{t('privacy.admin.requested', { date: format.dateTime(item.requestedAt) })}</p>
          </Card>
        ))}
      </div>
    </>
  );
}
