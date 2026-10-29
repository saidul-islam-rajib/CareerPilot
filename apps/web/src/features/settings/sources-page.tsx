'use client';

import { useState } from 'react';
import Link from 'next/link';
import { BriefcaseBusiness, ExternalLink, Globe, Plus, Trash2 } from 'lucide-react';
import type { UserSource } from '@careerpilot/api-client';
import {
  arrangementCounts,
  arrangementKey,
  sourceProblemKey,
  sourceReviewKey,
  useAddJobSourceForm,
  useFormat,
  useJobSources,
  useRemoveJobSource,
  useT,
} from '@careerpilot/client-core';
import { EnumKey, StatusTone } from '@careerpilot/domain-ui-logic';
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  EnumBadge,
  ErrorState,
  FormDialog,
  LoadingState,
  PageHeader,
  TextAreaField,
  TextField,
  buttonVariants,
  useToast,
} from '@careerpilot/ui-web';
import { Routes } from '@/core/routes';

function AddSourceDialog({ onClose }: { onClose: () => void }) {
  const t = useT();
  const toast = useToast();
  const form = useAddJobSourceForm((source) => {
    toast.show({ message: t('sources.added', { name: source.name, count: source.jobsFound }) });
    onClose();
  });
  return (
    <FormDialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={t('sources.addTitle')}
      description={t('sources.addBody')}
      submitLabel={form.adding ? t('sources.finding') : t('sources.submit')}
      submitting={form.adding}
      error={form.formError ? t(form.formError) : undefined}
      onSubmit={form.submit}
    >
      <TextField
        label={t('sources.url')}
        autoComplete="organization"
        autoCapitalize="none"
        spellCheck={false}
        value={form.values.url}
        onChange={(e) => form.setField('url', e.target.value)}
        error={form.errors.url}
        hint={t('sources.urlHint')}
      />
      <TextField
        label={t('sources.name')}
        value={form.values.name ?? ''}
        maxLength={form.nameMaxLength}
        onChange={(e) => form.setField('name', e.target.value)}
        hint={t('sources.nameHint')}
      />
      <TextAreaField
        label={t('sources.note')}
        value={form.values.note ?? ''}
        maxLength={form.noteMaxLength}
        rows={3}
        onChange={(e) => form.setField('note', e.target.value)}
        hint={t('sources.noteHint')}
      />
    </FormDialog>
  );
}

function SourceRow({ source }: { source: UserSource }) {
  const t = useT();
  const format = useFormat();
  const toast = useToast();
  const remove = useRemoveJobSource();
  return (
    <li className="flex flex-col gap-3 py-4 sm:flex-row sm:items-start">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-semibold text-foreground">{source.name}</p>
          <EnumBadge enumKey={EnumKey.SourceReview} value={source.review} />
          <EnumBadge enumKey={EnumKey.SourceStatus} value={source.status} />
        </div>
        {source.siteUrl ? (
          <a href={source.siteUrl} target="_blank" rel="noreferrer noopener" className="inline-flex min-w-0 items-center gap-1 text-sm text-primary underline-offset-2 hover:underline">
            <span className="truncate">{source.siteUrl}</span>
            <ExternalLink className="size-3.5 shrink-0" aria-hidden />
            <span className="sr-only">{t('sources.visit')}</span>
          </a>
        ) : null}
        <p className="text-sm text-muted">
          {t('sources.jobsFound', { count: source.jobsFound })} · {source.lastCheckedAt ? t('sources.lastChecked', { time: format.dateTime(source.lastCheckedAt) }) : t('sources.notChecked')}
        </p>
        <p className="text-sm text-muted">{t(sourceReviewKey(source))}</p>
        {source.reviewNote ? <p className="break-words text-sm text-foreground">{t('sources.reviewNote', { note: source.reviewNote })}</p> : null}
        {source.lastError ? <p className="text-sm text-warning">{t(sourceProblemKey(source.lastError))}</p> : null}
        {source.jobsFound > 0 ? (
          <div className="mt-1 flex flex-wrap items-center gap-2">
            {arrangementCounts(source.arrangements).map(({ arrangement, count }) => (
              <Badge key={arrangement} label={t('sources.arrangementCount', { label: t(arrangementKey(arrangement)), count })} />
            ))}
            <Link href={Routes.sourceJobs(source.id)} className={buttonVariants({ variant: 'secondary', size: 'sm' })}>
              <BriefcaseBusiness className="size-4" aria-hidden />
              {t('sources.viewJobs')}
            </Link>
          </div>
        ) : null}
      </div>
      <ConfirmDialog
        title={t('sources.removeTitle', { name: source.name })}
        body={t('sources.removeBody')}
        confirmLabel={t('sources.remove')}
        destructive
        onConfirm={() => void remove.mutateAsync(source.id).then(() => toast.show({ message: t('sources.removed', { name: source.name }) }))}
        trigger={
          <Button variant="ghost" size="sm" icon={Trash2} className="shrink-0 self-start" loading={remove.isPending} aria-label={`${t('sources.remove')}: ${source.name}`}>
            {t('common.remove')}
          </Button>
        }
      />
    </li>
  );
}

export function SourcesPage() {
  const t = useT();
  const sources = useJobSources();
  const form = useAddJobSourceForm();
  const [adding, setAdding] = useState(0);

  if (sources.isPending) {
    return <LoadingState />;
  }
  if (sources.isError) {
    return <ErrorState onRetry={() => void sources.refetch()} />;
  }
  const full = sources.data.length >= form.maxSources;
  return (
    <>
      <PageHeader
        title={t('sources.title')}
        description={t('sources.body')}
        actions={
          <Button icon={Plus} disabled={full} onClick={() => setAdding((count) => count + 1)}>
            {t('sources.add')}
          </Button>
        }
      />
      <section aria-labelledby="my-sources-title">
        <Card className="gap-2">
          <div className="flex items-center gap-3">
            <Globe className="size-5 shrink-0 text-primary" aria-hidden />
            <h2 id="my-sources-title" className="min-w-0 flex-1 text-lg font-semibold">
              {t('sources.mine')}
            </h2>
            <Badge label={t('sources.count', { count: sources.data.length, max: form.maxSources })} tone={full ? StatusTone.Warning : StatusTone.Neutral} />
          </div>
          {sources.data.length === 0 ? (
            <EmptyState body={t('sources.empty')} />
          ) : (
            <ul className="divide-y divide-border">
              {sources.data.map((source) => (
                <SourceRow key={source.id} source={source} />
              ))}
            </ul>
          )}
        </Card>
      </section>
      {adding > 0 ? <AddSourceDialog key={adding} onClose={() => setAdding(0)} /> : null}
    </>
  );
}
