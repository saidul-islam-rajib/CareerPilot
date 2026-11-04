'use client';

import { useState } from 'react';
import Link from 'next/link';
import { shiftReportDate, useFormat, useReport, useRequestExport, useT } from '@careerpilot/client-core';
import { ExportFormat, ExportKind, ReportPeriod, StatusTone } from '@careerpilot/domain-ui-logic';
import { Badge, Button, Card, EmptyState, ErrorState, LoadingState, PageHeader, Segmented, useToast } from '@careerpilot/ui-web';
import { Routes } from '@/core/routes';

const TODAY_LENGTH = 10;

export function ReportsPage() {
  const t = useT();
  const format = useFormat();
  const toast = useToast();
  const [period, setPeriod] = useState<ReportPeriod>(ReportPeriod.Daily);
  const [date, setDate] = useState<string | undefined>(undefined);
  const report = useReport(period, date);
  const exportReport = useRequestExport();
  const anchor = date ?? report.data?.startDate ?? new Date().toISOString().slice(0, TODAY_LENGTH);
  const ask = (file: ExportFormat) =>
    exportReport.mutate(
      { kind: ExportKind.Report, format: file, period, date: anchor },
      { onSuccess: () => toast.show({ message: t('reports.exportQueued') }) },
    );
  return (
    <>
      <PageHeader title={t('reports.screenTitle')} />
      <Segmented
        label={t('reports.screenTitle')}
        value={period}
        onChange={(next) => {
          setPeriod(next);
          setDate(undefined);
        }}
        options={[
          { value: ReportPeriod.Daily, label: t('reports.daily') },
          { value: ReportPeriod.Weekly, label: t('reports.weekly') },
        ]}
      />
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="secondary" onClick={() => setDate(shiftReportDate(anchor, period, -1))}>
          {t('reports.previous')}
        </Button>
        <Button variant="secondary" onClick={() => setDate(shiftReportDate(anchor, period, 1))}>
          {t('reports.next')}
        </Button>
        <Button variant="ghost" onClick={() => setDate(undefined)}>
          {t('reports.thisPeriod')}
        </Button>
        <Button variant="secondary" onClick={() => ask(ExportFormat.Csv)}>
          {t('reports.exportCsv')}
        </Button>
        <Button variant="secondary" onClick={() => ask(ExportFormat.Pdf)}>
          {t('reports.exportPdf')}
        </Button>
      </div>
      {report.isLoading ? <LoadingState /> : null}
      {report.isError ? <ErrorState onRetry={() => void report.refetch()} /> : null}
      {report.data ? (
        <>
          <p className="text-sm text-muted">{t('reports.range', { start: report.data.startDate, end: report.data.endDate })}</p>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {report.data.buckets.map((bucket) => (
              <Card key={bucket.bucket} className="gap-1">
                <span className="text-sm text-muted">{t(`reports.bucket.${bucket.bucket}`)}</span>
                <span className="text-2xl font-semibold">{bucket.count}</span>
              </Card>
            ))}
          </div>
          <p>{t('reports.responses', { count: report.data.responses })}</p>
          {report.data.rows.length === 0 ? <EmptyState title={t('reports.nothing')} /> : null}
          <Card className="gap-3">
            {report.data.rows.map((row) => (
              <div key={row.applicationId} className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-col">
                  <span className="font-semibold">{row.title}</span>
                  <span className="text-sm text-muted">{row.organization}</span>
                </div>
                <Badge label={t(`reports.bucket.${row.bucket}`)} tone={StatusTone.Neutral} />
                <Link className="text-primary underline" href={Routes.application(row.applicationId)}>
                  {t('reports.openRecord')}
                </Link>
              </div>
            ))}
          </Card>
          {report.data.upcoming.length > 0 ? (
            <Card className="gap-2">
              <h2 className="text-lg font-semibold">{t('reports.upcoming')}</h2>
              {report.data.upcoming.map((item) => (
                <p key={`${item.applicationId}-${item.dueAt}`}>
                  {t('reports.upcomingLine', { when: format.dateTime(item.dueAt), organization: item.organization, title: item.taskTitle })}
                </p>
              ))}
            </Card>
          ) : null}
        </>
      ) : null}
    </>
  );
}
