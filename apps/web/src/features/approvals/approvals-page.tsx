'use client';

import { Clock } from 'lucide-react';
import { useApprovals, useFormat, useT } from '@careerpilot/client-core';
import { EmptyState, ErrorState, LoadingState, PageHeader } from '@careerpilot/ui-web';
import { Routes } from '@/core/routes';
import { OpportunityCard } from '@/features/opportunities/opportunity-card';

export function ApprovalsPage() {
  const t = useT();
  const format = useFormat();
  const approvals = useApprovals();
  const items = approvals.data ?? [];
  return (
    <>
      <PageHeader title={t('approvals.title')} description={items.length > 0 ? t('approvals.pendingCount', { count: items.length }) : undefined} />
      {approvals.isPending ? <LoadingState /> : null}
      {approvals.isError ? <ErrorState onRetry={() => void approvals.refetch()} /> : null}
      {approvals.isSuccess && items.length === 0 ? <EmptyState title={t('approvals.empty')} /> : null}
      <div className="grid gap-4 md:grid-cols-2">
        {items.map((approval) => (
          <div key={approval.id} className="flex flex-col gap-1">
            <span className="flex items-center gap-1 text-xs text-warning">
              <Clock className="size-4" aria-hidden />
              {t('approvals.expiresOn', { date: format.dateTime(approval.expiresAt) })}
            </span>
            <OpportunityCard opportunity={approval.opportunity} href={Routes.approval(approval.id)} />
          </div>
        ))}
      </div>
    </>
  );
}
