'use client';

import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';
import { enumLabelKey, useBulkApprovals, useT } from '@careerpilot/client-core';
import { StatusTone } from '@careerpilot/domain-ui-logic';
import { Banner, Button, Card, Checkbox, EmptyState, ErrorState, LoadingState, PageHeader } from '@careerpilot/ui-web';
import { Routes } from '@/core/routes';

export function BulkApprovalsPage() {
  const t = useT();
  const bulk = useBulkApprovals();
  const { result } = bulk;
  return (
    <>
      <PageHeader title={t('approvals.bulk.title')} description={t('approvals.bulk.body')} />
      {bulk.rows.isPending ? <LoadingState /> : null}
      {bulk.rows.isError ? <ErrorState onRetry={() => void bulk.rows.refetch()} /> : null}
      {bulk.rows.isSuccess && bulk.items.length === 0 ? <EmptyState title={t('approvals.bulk.empty')} /> : null}
      {result ? (
        <Banner
          tone={result.refused.length > 0 ? StatusTone.Warning : StatusTone.Success}
          icon={AlertTriangle}
          title={[t('approvals.bulk.approved', { count: result.approved.length }), result.refused.length > 0 ? t('approvals.bulk.refused', { count: result.refused.length }) : ''].join(' ').trim()}
        />
      ) : null}
      {bulk.failed ? <p role="alert">{t('approvals.bulk.failed')}</p> : null}
      <div className="flex flex-col gap-3">
        {bulk.items.map((row) => {
          const warnings = result?.refused.find((item) => item.approvalId === row.approvalId)?.reasons ?? row.warnings;
          const files = [t('approvals.bulk.cv', { name: row.cvName }), ...row.writingKinds.map((kind) => t(enumLabelKey('writing_kind', kind)))];
          const details = (
            <div className="flex flex-col gap-1">
              <span className="font-semibold">
                {row.employer} · {row.role}
              </span>
              <span className="text-muted">
                {t('approvals.bulk.route')}: {t(enumLabelKey('application_route', row.route))}
              </span>
              <span className="text-muted">
                {t('approvals.bulk.files')}: {files.join(', ')}
              </span>
              {warnings.map((warning) => (
                <span key={warning} className="text-warning">
                  {t(`approvals.bulk.block.${warning}`)}
                </span>
              ))}
            </div>
          );
          return (
            <Card key={row.approvalId}>
              {row.eligible ? (
                <Checkbox checked={bulk.selected.includes(row.approvalId)} onChange={() => bulk.toggle(row.approvalId)}>
                  {details}
                </Checkbox>
              ) : (
                <div className="flex flex-col gap-2">
                  {details}
                  <Link href={Routes.approval(row.approvalId)} className="text-primary underline">
                    {t('approvals.bulk.oneByOne')}
                  </Link>
                </div>
              )}
            </Card>
          );
        })}
      </div>
      {bulk.items.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={bulk.selectAll}>
            {t('approvals.bulk.selectAll')}
          </Button>
          <Button variant="ghost" onClick={bulk.clear}>
            {t('approvals.bulk.clear')}
          </Button>
          <Button onClick={bulk.approve} disabled={bulk.selected.length === 0 || bulk.approving} loading={bulk.approving}>
            {t('approvals.bulk.approve', { count: bulk.selected.length })}
          </Button>
        </div>
      ) : null}
    </>
  );
}
