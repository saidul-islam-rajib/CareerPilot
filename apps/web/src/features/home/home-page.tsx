'use client';

import Link from 'next/link';
import { PauseCircle } from 'lucide-react';
import { trackTitle, useDashboard, useFormat, useResume, useSession, useT } from '@careerpilot/client-core';
import { StatusTone } from '@careerpilot/domain-ui-logic';
import { Banner, Button, EmptyState, ErrorState, LoadingState, PageHeader, Section } from '@careerpilot/ui-web';
import { Routes } from '@/core/routes';
import { OpportunityCard } from '@/features/opportunities/opportunity-card';

function StatTile({ label, value, href }: { label: string; value: number; href?: string }) {
  const content = (
    <>
      <span className="text-3xl font-bold text-primary">{value}</span>
      <span className="text-sm text-muted">{label}</span>
    </>
  );
  const classes = 'flex flex-col gap-1 rounded-card border border-border bg-card p-4';
  return href ? (
    <Link href={href} aria-label={`${label}: ${value}`} className={`${classes} hover:border-primary`}>
      {content}
    </Link>
  ) : (
    <div aria-label={`${label}: ${value}`} className={classes}>
      {content}
    </div>
  );
}

export function HomePage() {
  const t = useT();
  const format = useFormat();
  const { user } = useSession();
  const dashboard = useDashboard();
  const resume = useResume();
  const firstName = user?.fullName.split(' ')[0] ?? '';

  return (
    <>
      <PageHeader title={t('home.greeting', { name: firstName })} description={t('home.summary')} />
      {dashboard.isPending ? <LoadingState /> : null}
      {dashboard.isError ? <ErrorState onRetry={() => void dashboard.refetch()} /> : null}
      {dashboard.data ? (
        <>
          {dashboard.data.pause ? (
            <Banner
              tone={StatusTone.Warning}
              icon={PauseCircle}
              title={t('home.pausedTitle')}
              body={dashboard.data.pause.until ? t('home.pausedUntil', { date: format.date(dashboard.data.pause.until) }) : t('home.pausedIndefinitely')}
              action={
                <Button variant="outline" onClick={() => resume.mutate()} loading={resume.isPending}>
                  {t('home.resume')}
                </Button>
              }
            />
          ) : null}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatTile label={t('home.newMatches')} value={dashboard.data.counts.newMatches} />
            <StatTile label={t('home.awaitingApproval')} value={dashboard.data.counts.awaitingApproval} href={Routes.approvals} />
            <StatTile label={t('home.appliedThisWeek')} value={dashboard.data.counts.appliedThisWeek} href={Routes.applications} />
            <StatTile label={t('home.interviews')} value={dashboard.data.counts.interviews} href={Routes.applications} />
          </div>
          <p className="text-xs text-muted">{t('home.lastChecked', { date: format.dateTime(dashboard.data.lastCheckedAt) })}</p>
          {dashboard.data.tracks.map(({ track, opportunities }) => (
            <Section key={track.id} title={trackTitle(track, t)}>
              {opportunities.length === 0 ? (
                <EmptyState body={t('home.trackEmpty')} />
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  {opportunities.map((opportunity) => (
                    <OpportunityCard key={opportunity.id} opportunity={opportunity} />
                  ))}
                </div>
              )}
            </Section>
          ))}
        </>
      ) : null}
    </>
  );
}
