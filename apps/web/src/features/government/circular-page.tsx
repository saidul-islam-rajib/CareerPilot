'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { TriangleAlert } from 'lucide-react';
import type { GovPost, PostEligibility } from '@careerpilot/api-client';
import {
  eligibilityOfPost,
  moveItem,
  reasonKey,
  useCircular,
  useFormat,
  useGovernmentReference,
  useStartGovApplication,
  useT,
} from '@careerpilot/client-core';
import { Eligibility, StatusTone } from '@careerpilot/domain-ui-logic';
import { Badge, Banner, Button, Card, Checkbox, ErrorState, LoadingState, PageHeader, Section, SortableList, useToast } from '@careerpilot/ui-web';
import { ApiErrorDetail, isApiError } from '@careerpilot/api-client';
import { Routes } from '@/core/routes';
import { DayNote, EligibilityBadge, enumLabelKey } from './government-parts';

function PostDetails({ post, eligibility }: { post: GovPost; eligibility?: PostEligibility }) {
  const t = useT();
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-semibold">{post.title}</p>
        {eligibility ? <EligibilityBadge outcome={eligibility.overall} /> : null}
      </div>
      <p className="text-sm text-muted">
        {[
          post.grade ? t('government.circular.grade', { grade: post.grade }) : undefined,
          post.payMin !== undefined && post.payMax !== undefined ? t('government.circular.payScale', { min: post.payMin, max: post.payMax }) : undefined,
          post.vacancies !== undefined ? t('government.circular.vacancies', { count: post.vacancies }) : t('government.circular.vacanciesUnknown'),
          post.location || undefined,
        ]
          .filter(Boolean)
          .join(' · ')}
      </p>
      {eligibility?.criteria.length ? (
        <ul className="flex flex-col gap-1 text-sm">
          {eligibility.criteria.map((criterion) => (
            <li key={`${criterion.kind}-${criterion.exam ?? ''}`}>
              <span className="font-medium">{t(enumLabelKey('criterion_kind', criterion.kind))}</span>: {t(reasonKey(criterion.reason))}
              {criterion.expected ? ` ${t('government.criteria.expected', { value: criterion.expected })}` : ''}
              {criterion.found ? ` ${t('government.criteria.found', { value: criterion.found })}` : ''}
            </li>
          ))}
        </ul>
      ) : null}
      {eligibility?.quotas.length ? (
        <p className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-medium">{t('government.criteria.quotas')}</span>
          {eligibility.quotas.map((quota) => (
            <Badge key={quota.kind} label={t(enumLabelKey('quota_kind', quota.kind))} tone={quota.outcome === Eligibility.Met ? StatusTone.Success : StatusTone.Neutral} />
          ))}
        </p>
      ) : null}
    </div>
  );
}

export function CircularPage() {
  const { id } = useParams<{ id: string }>();
  const t = useT();
  const format = useFormat();
  const router = useRouter();
  const toast = useToast();
  const view = useCircular(id);
  const currency = useGovernmentReference().data?.currency ?? '';
  const start = useStartGovApplication();
  const [chosen, setChosen] = useState<string[]>([]);

  if (view.isPending) {
    return <LoadingState />;
  }
  if (view.isError) {
    return <ErrorState onRetry={() => void view.refetch()} />;
  }
  const { circular, posts } = view.data;
  const postOf = (postId: string) => circular.posts.find((post) => post.id === postId);
  const toggle = (postId: string, on: boolean) => setChosen((current) => (on ? [...current, postId] : current.filter((value) => value !== postId)));
  const begin = () => {
    if (!chosen.length) {
      toast.show({ message: t('government.circular.pickOne') });
      return;
    }
    start.mutate(
      { circularId: id, postIds: chosen },
      {
        onSuccess: (application) => router.push(Routes.governmentApplication(application.id)),
        onError: (error) =>
          toast.show({ message: isApiError(error) && error.detail === ApiErrorDetail.AlreadyTracking ? t('government.circular.already') : t('government.errors.generic') }),
      },
    );
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={circular.title} description={circular.authority} />
      {view.data.amended ? <Banner tone={StatusTone.Warning} icon={TriangleAlert} title={t('government.circular.amended')} body={t('government.circular.amendedBody')} /> : null}
      {circular.liveRemoved ? <Banner tone={StatusTone.Info} icon={TriangleAlert} title={t('government.circular.liveRemoved')} /> : null}
      <Card>
        <p>
          {circular.closesOn ? t('government.circular.closes', { date: format.date(circular.closesOn) }) : t('government.circular.closesNone')}
          {circular.closesTime ? ` ${circular.closesTime}` : ''}
        </p>
        <DayNote note={view.data.closeNote} />
        {circular.ageCutoffOn ? <p className="text-sm">{t('government.circular.cutoff', { date: format.date(circular.ageCutoffOn) })}</p> : null}
        <p className="text-sm">
          {circular.fee?.amount !== undefined ? t('government.circular.fee', { amount: circular.fee.amount, currency }) : t('government.circular.feeNone')}
        </p>
        <p className="text-sm text-muted">{t('government.circular.version', { version: circular.version })}</p>
        <div className="flex flex-wrap gap-3 text-sm">
          {circular.noticeUrl ? <a className="text-primary underline" href={circular.noticeUrl} target="_blank" rel="noreferrer">{t('government.circular.notice')}</a> : null}
          {circular.applyUrl ? <a className="text-primary underline" href={circular.applyUrl} target="_blank" rel="noreferrer">{t('government.circular.apply')}</a> : null}
        </div>
      </Card>
      <Section title={t('government.circular.posts')}>
        <p className="text-sm text-muted">{t('government.criteria.profileHint')}</p>
        {circular.posts.map((post) => (
          <Card key={post.id}>
            <Checkbox checked={chosen.includes(post.id)} onChange={(on) => toggle(post.id, on)}>
              {t('government.circular.selected')}
            </Checkbox>
            <PostDetails post={post} eligibility={eligibilityOfPost(posts, post.id)} />
          </Card>
        ))}
      </Section>
      {chosen.length > 1 ? (
        <Section title={t('government.circular.choosePosts')}>
          <p className="text-sm text-muted">{t('government.circular.rankHint')}</p>
          <Card>
            <SortableList
              items={chosen}
              keyOf={(postId) => postId}
              labelOf={(postId) => postOf(postId)?.title ?? postId}
              renderItem={(postId) => <span>{postOf(postId)?.title ?? postId}</span>}
              onReorder={(from, to) => setChosen((current) => moveItem(current, from, to))}
            />
          </Card>
        </Section>
      ) : null}
      {circular.notices.length ? (
        <Section title={t('government.circular.notices')}>
          <Card>
            {circular.notices.map((notice) => (
              <p key={notice.id} className="text-sm">
                <Badge label={t(enumLabelKey('notice_kind', notice.kind))} /> {notice.url ? <a className="text-primary underline" href={notice.url} target="_blank" rel="noreferrer">{notice.title}</a> : notice.title}
              </p>
            ))}
          </Card>
        </Section>
      ) : null}
      {circular.requiredDocuments.length ? (
        <Section title={t('government.circular.documents')}>
          <Card>
            <ul className="list-disc pl-5 text-sm">{circular.requiredDocuments.map((document) => <li key={document}>{document}</li>)}</ul>
          </Card>
        </Section>
      ) : null}
      <div>
        <Button onClick={begin} loading={start.isPending}>
          {t('government.circular.start')}
        </Button>
      </div>
    </div>
  );
}
