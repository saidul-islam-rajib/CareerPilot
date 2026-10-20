'use client';

import { useParams } from 'next/navigation';
import { Archive, ExternalLink } from 'lucide-react';
import { useFormat, useOpportunity, useT } from '@careerpilot/client-core';
import { StatusTone } from '@careerpilot/domain-ui-logic';
import { Banner, Card, ErrorState, LoadingState, PageHeader } from '@careerpilot/ui-web';

export function CircularPage() {
  const { id } = useParams<{ id: string }>();
  const t = useT();
  const format = useFormat();
  const opportunity = useOpportunity(id);
  if (opportunity.isPending) {
    return <LoadingState />;
  }
  if (opportunity.isError) {
    return <ErrorState onRetry={() => void opportunity.refetch()} />;
  }
  const { circular } = opportunity.data;
  return (
    <>
      <PageHeader title={t('applications.circular')} description={`${opportunity.data.title} · ${opportunity.data.organization}`} />
      <Banner tone={StatusTone.Info} icon={Archive} title={t('opportunity.circularArchived', { date: format.dateTime(circular.archivedAt) })} />
      <Card>
        <pre className="whitespace-pre-wrap font-sans">{circular.text}</pre>
      </Card>
      <a href={circular.originalUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 break-all text-sm font-medium text-primary">
        <ExternalLink className="size-4 shrink-0" aria-hidden />
        {circular.originalUrl}
      </a>
    </>
  );
}
