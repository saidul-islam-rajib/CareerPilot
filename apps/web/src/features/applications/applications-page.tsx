'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ApplicationFilter, type ApplicationSummary } from '@careerpilot/api-client';
import { useApplications, useFormat, useT } from '@careerpilot/client-core';
import { EnumKey } from '@careerpilot/domain-ui-logic';
import { EmptyState, EnumBadge, ErrorState, LoadingState, PageHeader, Segmented } from '@careerpilot/ui-web';
import { Routes } from '@/core/routes';

function ApplicationRow({ application }: { application: ApplicationSummary }) {
  const t = useT();
  const format = useFormat();
  return (
    <Link href={Routes.application(application.id)} className="flex flex-col gap-2 rounded-card border border-border bg-card p-4 hover:border-primary md:flex-row md:items-center md:gap-4">
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="font-semibold">{application.opportunity.title}</span>
        <span className="text-sm text-muted">
          {application.opportunity.organization} · {application.opportunity.location}
        </span>
      </span>
      <span className="flex flex-wrap gap-2">
        <EnumBadge enumKey={EnumKey.SubmissionStatus} value={application.submissionStatus} />
        <EnumBadge enumKey={EnumKey.OutcomeStatus} value={application.outcomeStatus} />
      </span>
      <span className="text-xs text-muted md:w-36 md:text-right">
        {application.appliedAt ? t('applications.appliedOn', { date: format.date(application.appliedAt) }) : t('common.updatedAt', { date: format.date(application.updatedAt) })}
      </span>
    </Link>
  );
}

export function ApplicationsPage() {
  const t = useT();
  const [filter, setFilter] = useState<ApplicationFilter>(ApplicationFilter.All);
  const applications = useApplications(filter);
  const options = [
    { value: ApplicationFilter.All, label: t('applications.filterAll') },
    { value: ApplicationFilter.Active, label: t('applications.filterActive') },
    { value: ApplicationFilter.Submitted, label: t('applications.filterSubmitted') },
    { value: ApplicationFilter.Attention, label: t('applications.filterAttention') },
  ];
  return (
    <>
      <PageHeader title={t('applications.title')} />
      <Segmented options={options} value={filter} onChange={setFilter} label={t('applications.title')} />
      {applications.isPending ? <LoadingState /> : null}
      {applications.isError ? <ErrorState onRetry={() => void applications.refetch()} /> : null}
      {applications.isSuccess && applications.data.length === 0 ? <EmptyState title={t('applications.empty')} /> : null}
      <div className="flex flex-col gap-3">
        {applications.data?.map((application) => (
          <ApplicationRow key={application.id} application={application} />
        ))}
      </div>
    </>
  );
}
