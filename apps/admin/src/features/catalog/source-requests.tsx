'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, Lock } from 'lucide-react';
import type { AdminSourceRow, SourceDecision } from '@careerpilot/api-client';
import { useFormat, usePublicConfig, useT } from '@careerpilot/client-core';
import { SourceReview } from '@careerpilot/domain-ui-logic';
import { Button, Card, FormDialog, TextAreaField, useToast } from '@careerpilot/ui-web';
import { adminKeys, useAdminMutation } from '@/core/admin-queries';
import { useAdminApi } from '@/core/admin-services';
import { sourceProblemKey } from './source-forms';

const REQUIRED = 'validation.required';

interface ReviewTarget {
  source: AdminSourceRow;
  review: SourceReview;
}

export function requestedByKey(source: AdminSourceRow): string {
  return source.ownerIds.length === 1 ? 'admin.sources.requestedByOne' : 'admin.sources.requestedBy';
}

function ReviewDialog({ target, onClose }: { target: ReviewTarget; onClose: () => void }) {
  const t = useT();
  const api = useAdminApi();
  const toast = useToast();
  const { config } = usePublicConfig();
  const [note, setNote] = useState('');
  const [error, setError] = useState<string>();
  const approving = target.review === SourceReview.Approved;
  const review = useAdminMutation(async (decision: SourceDecision) => {
    const row = await api.sources.reviewSource(target.source.id, decision);
    toast.show({ message: t(approving ? 'admin.sources.approved' : 'admin.sources.rejected', { name: row.name }) });
    onClose();
    return row;
  });
  const submit = () => {
    const missing = note.trim() ? undefined : REQUIRED;
    setError(missing);
    if (!missing) {
      review.mutate({ review: target.review, note: note.trim() });
    }
  };
  return (
    <FormDialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={t(approving ? 'admin.sources.approveTitle' : 'admin.sources.rejectTitle', { name: target.source.name })}
      description={t(approving ? 'admin.sources.approveBody' : 'admin.sources.rejectBody')}
      submitLabel={t(approving ? 'admin.sources.approve' : 'admin.sources.reject')}
      submitting={review.isPending}
      error={review.error ? t('admin.sources.reviewFailed') : undefined}
      onSubmit={submit}
    >
      <TextAreaField
        label={t('admin.sources.justification')}
        hint={t('admin.sources.justificationHint')}
        value={note}
        maxLength={config.validationPolicy.note.maxLength}
        rows={3}
        onChange={(e) => {
          setNote(e.target.value);
          setError(undefined);
        }}
        error={error}
      />
    </FormDialog>
  );
}

function RequestRow({ source, canReview, onReview }: { source: AdminSourceRow; canReview: boolean; onReview: (review: SourceReview) => void }) {
  const t = useT();
  const format = useFormat();
  const site = source.setup?.siteUrl || source.setup?.url || '';
  return (
    <li className="flex flex-col gap-3 py-3 lg:flex-row lg:items-start lg:justify-between">
      <div className="flex min-w-0 flex-col gap-1">
        <span className="font-semibold text-foreground">{source.name}</span>
        {site ? (
          <a href={site} target="_blank" rel="noreferrer noopener" className="truncate text-sm text-primary underline-offset-2 hover:underline">
            {site}
          </a>
        ) : null}
        <span className="text-xs text-muted">
          {t(requestedByKey(source), { count: source.ownerIds.length })}
          {source.requestedAt ? ` · ${format.dateTime(source.requestedAt)}` : ''} · {t('admin.columns.found')}: {source.opportunitiesFound}
        </span>
        {source.requestNote ? <span className="break-words text-sm text-foreground">{t('admin.sources.requestNote', { note: source.requestNote })}</span> : null}
        {source.lastError ? <span className="text-xs text-muted">{t(sourceProblemKey(source.lastError))}</span> : null}
      </div>
      {canReview ? (
        <div className="flex shrink-0 gap-2">
          <Button size="sm" icon={Check} onClick={() => onReview(SourceReview.Approved)} aria-label={`${t('admin.sources.approve')}: ${source.name}`}>
            {t('admin.sources.approve')}
          </Button>
          <Button size="sm" variant="outline" icon={Lock} onClick={() => onReview(SourceReview.Rejected)} aria-label={`${t('admin.sources.reject')}: ${source.name}`}>
            {t('admin.sources.reject')}
          </Button>
        </div>
      ) : null}
    </li>
  );
}

export function SourceRequests({ canReview }: { canReview: boolean }) {
  const t = useT();
  const api = useAdminApi();
  const requests = useQuery({ queryKey: adminKeys.sourceRequests, queryFn: () => api.sources.sourceRequests() });
  const [target, setTarget] = useState<ReviewTarget>();
  if (!requests.data?.length) {
    return null;
  }
  return (
    <Card className="gap-3 border-warning p-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-base font-semibold text-foreground">
          {t('admin.sources.requestsTitle')} ({requests.data.length})
        </h2>
        <p className="text-sm text-muted">{t('admin.sources.requestsBody')}</p>
      </div>
      <ul className="flex flex-col divide-y divide-border">
        {requests.data.map((source) => (
          <RequestRow key={source.id} source={source} canReview={canReview} onReview={(review) => setTarget({ source, review })} />
        ))}
      </ul>
      {target ? <ReviewDialog key={`${target.source.id}-${target.review}`} target={target} onClose={() => setTarget(undefined)} /> : null}
    </Card>
  );
}
