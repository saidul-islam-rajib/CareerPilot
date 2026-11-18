'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { OpportunityReport } from '@careerpilot/api-client';
import { useFormat, useT } from '@careerpilot/client-core';
import { ReportStatus, StatusTone } from '@careerpilot/domain-ui-logic';
import { Badge, Button, Card, EmptyState, ErrorState, LoadingState, PageHeader, SelectField } from '@careerpilot/ui-web';
import { useAdminApi } from '@/core/admin-services';

const KEY = ['admin', 'opportunity-reports'] as const;
const ALL = '';
const STATUS_TONE: Record<ReportStatus, StatusTone> = {
  open: StatusTone.Warning,
  reviewed: StatusTone.Info,
  actioned: StatusTone.Success,
  dismissed: StatusTone.Neutral,
};

function useReports(status: ReportStatus | typeof ALL) {
  const api = useAdminApi();
  return useQuery({ queryKey: [...KEY, status], queryFn: () => api.opportunities.listReports(status === ALL ? undefined : status) });
}

function useSetStatus() {
  const api = useAdminApi();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; status: ReportStatus }) => api.opportunities.setReportStatus(input.id, input.status),
    onSuccess: () => client.invalidateQueries({ queryKey: KEY }),
  });
}

function ReportCard({ report }: { report: OpportunityReport }) {
  const t = useT();
  const format = useFormat();
  const setStatus = useSetStatus();
  return (
    <Card className="gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold">{report.opportunityTitle}</span>
        <Badge label={t(`listingReports.kinds.${report.kind}`)} tone={StatusTone.Danger} />
        <Badge label={t(`listingReports.statuses.${report.status}`)} tone={STATUS_TONE[report.status]} />
      </div>
      {report.note ? <p>{report.note}</p> : null}
      <p className="text-muted">{t('listingReports.admin.by', { date: format.dateTime(report.createdAt) })}</p>
      <div className="flex flex-wrap gap-2">
        {Object.values(ReportStatus)
          .filter((status) => status !== report.status)
          .map((status) => (
            <Button key={status} variant="outline" disabled={setStatus.isPending} onClick={() => setStatus.mutate({ id: report.id, status })}>
              {t('listingReports.admin.setStatus', { status: t(`listingReports.statuses.${status}`).toLowerCase() })}
            </Button>
          ))}
      </div>
      {setStatus.isError ? <p role="alert">{t('listingReports.admin.failed')}</p> : null}
    </Card>
  );
}

export function ReportsAdminPage() {
  const t = useT();
  const [status, setStatus] = useState<ReportStatus | typeof ALL>(ReportStatus.Open);
  const reports = useReports(status);
  return (
    <>
      <PageHeader title={t('listingReports.admin.title')} description={t('listingReports.admin.body')} />
      <SelectField
        label={t('listingReports.admin.title')}
        value={status}
        options={[{ value: ALL, label: '' }, ...Object.values(ReportStatus).map((value) => ({ value, label: t(`listingReports.statuses.${value}`) }))]}
        onValueChange={(value) => setStatus(value as ReportStatus | typeof ALL)}
      />
      {reports.isPending ? <LoadingState /> : null}
      {reports.isError ? <ErrorState onRetry={() => void reports.refetch()} /> : null}
      {reports.isSuccess && reports.data.length === 0 ? <EmptyState title={t('listingReports.admin.empty')} /> : null}
      <div className="flex flex-col gap-3">
        {reports.data?.map((report) => <ReportCard key={report.id} report={report} />)}
      </div>
    </>
  );
}
