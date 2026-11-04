'use client';

import { useState } from 'react';
import { TriangleAlert } from 'lucide-react';
import { exportKb, useExports, useFormat, useRequestExport, useT } from '@careerpilot/client-core';
import type { ExportInput } from '@careerpilot/api-client';
import { ExportFormat, ExportKind, ExportStatus, ReportPeriod, StatusTone } from '@careerpilot/domain-ui-logic';
import { Badge, Banner, Button, Card, EmptyState, ErrorState, LoadingState, PageHeader, TextField, useToast } from '@careerpilot/ui-web';
import { openAddress } from '@/core/open-address';

const QUICK: { label: string; input: ExportInput }[] = [
  { label: 'privacy.exports.applicationsCsv', input: { kind: ExportKind.Applications, format: ExportFormat.Csv } },
  { label: 'privacy.exports.applicationsPdf', input: { kind: ExportKind.Applications, format: ExportFormat.Pdf } },
  { label: 'privacy.exports.weeklyReportPdf', input: { kind: ExportKind.Report, format: ExportFormat.Pdf, period: ReportPeriod.Weekly } },
];

export function ExportsPage() {
  const t = useT();
  const format = useFormat();
  const toast = useToast();
  const exports = useExports();
  const request = useRequestExport();
  const [password, setPassword] = useState('');
  const ask = (input: ExportInput) =>
    request.mutate(input, {
      onSuccess: () => toast.show({ message: t('privacy.exports.requested') }),
      onError: () => toast.show({ message: t('privacy.exports.limit') }),
    });
  return (
    <>
      <PageHeader title={t('privacy.exports.title')} description={t('privacy.exports.intro')} />
      <Card className="gap-3">
        <div className="flex flex-wrap gap-2">
          {QUICK.map((item) => (
            <Button key={item.label} variant="secondary" onClick={() => ask(item.input)}>
              {t(item.label)}
            </Button>
          ))}
        </div>
      </Card>
      <Card className="max-w-xl gap-3">
        <h2 className="text-lg font-semibold">{t('privacy.exports.archiveTitle')}</h2>
        <p className="text-sm text-muted">{t('privacy.exports.archiveBody')}</p>
        <TextField label={t('privacy.exports.passwordLabel')} type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        <Button
          disabled={password.length === 0}
          loading={request.isPending}
          onClick={() => {
            ask({ kind: ExportKind.Archive, format: ExportFormat.Zip, password });
            setPassword('');
          }}
        >
          {t('privacy.exports.archiveAction')}
        </Button>
      </Card>
      <h2 className="text-lg font-semibold">{t('privacy.exports.history')}</h2>
      {exports.isLoading ? <LoadingState /> : null}
      {exports.isError ? <ErrorState onRetry={() => void exports.refetch()} /> : null}
      {exports.data?.length === 0 ? <EmptyState title={t('privacy.exports.empty')} /> : null}
      <div className="flex flex-col gap-3">
        {exports.data?.map((item) => (
          <Card key={item.id} className="gap-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-semibold">
                {t(`privacy.exports.kind.${item.kind}`)} ({item.format.toUpperCase()})
              </span>
              <Badge
                label={t(`privacy.exports.status.${item.status}`)}
                tone={item.status === ExportStatus.Ready ? StatusTone.Success : item.status === ExportStatus.Failed ? StatusTone.Danger : StatusTone.Neutral}
              />
            </div>
            {item.failure ? <Banner tone={StatusTone.Danger} icon={TriangleAlert} title={t(`privacy.exports.failure.${item.failure}`)} /> : null}
            {item.downloadUrl ? (
              <div className="flex flex-wrap items-center gap-3">
                <Button onClick={() => openAddress(item.downloadUrl ?? '')}>{t('privacy.exports.download')}</Button>
                <span className="text-sm text-muted">{t('privacy.exports.size', { size: exportKb(item.sizeBytes) })}</span>
                {item.expiresAt ? <span className="text-sm text-muted">{t('privacy.exports.availableUntil', { date: format.dateTime(item.expiresAt) })}</span> : null}
              </div>
            ) : null}
          </Card>
        ))}
      </div>
    </>
  );
}
