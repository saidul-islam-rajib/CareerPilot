'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, CalendarClock, Check, ExternalLink, MapPin, Plus } from 'lucide-react';
import type { SourceJob } from '@careerpilot/api-client';
import { arrangementCounts, arrangementKey, jobsIn, useFormat, useSaveSourceJob, useSourceJobs, useT } from '@careerpilot/client-core';
import type { WorkArrangement } from '@careerpilot/domain-ui-logic';
import { Badge, Button, Card, EmptyState, ErrorState, LoadingState, PageHeader, Segmented, buttonVariants, useToast } from '@careerpilot/ui-web';
import { Routes } from '@/core/routes';

const ALL = 'all';
type Filter = WorkArrangement | typeof ALL;

function JobRow({ sourceId, job }: { sourceId: string; job: SourceJob }) {
  const t = useT();
  const format = useFormat();
  const toast = useToast();
  const router = useRouter();
  const save = useSaveSourceJob(sourceId);
  const add = () =>
    save.mutate(job.id, {
      onSuccess: ({ opportunityId }) => {
        toast.show({ message: t('sources.jobAdded', { title: job.title }) });
        router.push(Routes.opportunity(opportunityId));
      },
    });
  return (
    <li className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-semibold text-foreground">{job.title}</p>
          <Badge label={t(arrangementKey(job.workArrangement))} />
        </div>
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
          {job.location ? (
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-4" aria-hidden />
              {job.location}
            </span>
          ) : null}
          <span className="inline-flex items-center gap-1">
            <CalendarClock className="size-4" aria-hidden />
            {format.deadline(job.deadline)}
          </span>
        </p>
      </div>
      <div className="flex shrink-0 flex-wrap gap-2">
        <a href={job.url} target="_blank" rel="noreferrer noopener" className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
          <ExternalLink className="size-4" aria-hidden />
          {t('sources.openJob')}
        </a>
        <Button
          size="sm"
          variant={job.listed ? 'outline' : 'secondary'}
          icon={job.listed ? Check : Plus}
          loading={save.isPending}
          disabled={job.listed}
          aria-label={job.listed ? t('sources.listedJob') : t('sources.addJobLabel', { title: job.title })}
          onClick={add}
        >
          {job.listed ? t('sources.listedJob') : t('sources.addJob')}
        </Button>
      </div>
    </li>
  );
}

export function SourceJobsPage() {
  const { id } = useParams<{ id: string }>();
  const t = useT();
  const found = useSourceJobs(id);
  const [filter, setFilter] = useState<Filter>(ALL);

  if (found.isPending) {
    return <LoadingState />;
  }
  if (found.isError) {
    return <ErrorState onRetry={() => void found.refetch()} />;
  }
  const { source, jobs } = found.data;
  const counts = arrangementCounts(source.arrangements);
  const shown = jobsIn(jobs, filter === ALL ? undefined : filter);
  const options = [
    { value: ALL as Filter, label: t('sources.allJobs', { count: jobs.length }) },
    ...counts.map(({ arrangement, count }) => ({ value: arrangement as Filter, label: t('sources.filterCount', { label: t(arrangementKey(arrangement)), count }) })),
  ];
  return (
    <>
      <Link href={Routes.sources} className="inline-flex min-h-11 items-center gap-2 self-start text-sm font-medium text-primary hover:underline">
        <ArrowLeft className="size-4" aria-hidden />
        {t('sources.back')}
      </Link>
      <PageHeader title={t('sources.jobsTitle', { name: source.name })} description={t('sources.jobsBody')} />
      <Card className="gap-4">
        {jobs.length === 0 ? (
          <EmptyState body={t('sources.jobsEmpty')} />
        ) : (
          <>
            <Segmented options={options} value={filter} onChange={setFilter} label={t('sources.jobsFilter')} />
            <ul className="divide-y divide-border">
              {shown.map((job) => (
                <JobRow key={job.id} sourceId={source.id} job={job} />
              ))}
            </ul>
          </>
        )}
      </Card>
    </>
  );
}
