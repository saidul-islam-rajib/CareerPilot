'use client';

import Link from 'next/link';
import { CalendarClock, ChevronRight, PauseCircle } from 'lucide-react';
import type { UpcomingTask } from '@careerpilot/api-client';
import { trackTitle, useDashboard, useFormat, useResume, useServices, useSession, useT } from '@careerpilot/client-core';
import { EnumKey, StatusTone } from '@careerpilot/domain-ui-logic';
import { Badge, Banner, Button, Card, EmptyState, EnumBadge, ErrorState, LoadingState, PageHeader, Section, cn } from '@careerpilot/ui-web';
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

function ComingUp({ items }: { items: UpcomingTask[] }) {
  const t = useT();
  const format = useFormat();
  const { clock } = useServices();
  const now = clock.now().getTime();
  return (
    <Section title={t('applications.comingUp')}>
      <Card className="gap-0 p-0">
        <ul className="divide-y divide-border">
          {items.map(({ applicationId, organization, title, task }) => {
            const overdue = task.dueAt !== undefined && Date.parse(task.dueAt) < now;
            return (
              <li key={task.id}>
                <Link
                  href={Routes.application(applicationId)}
                  className="flex items-center gap-3 p-4 hover:bg-neutral-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus"
                >
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-subtle text-primary">
                    <CalendarClock className="size-5" aria-hidden />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="font-semibold text-foreground">{task.title}</span>
                    <span className="text-sm text-muted">{`${title} · ${organization}`}</span>
                    <span className="flex flex-wrap items-center gap-2 text-xs">
                      <EnumBadge enumKey={EnumKey.TaskKind} value={task.kind} />
                      <span className={cn('text-muted', overdue && 'font-semibold text-danger')}>{task.dueAt ? format.dateTime(task.dueAt) : ''}</span>
                      {overdue ? <Badge label={t('applications.overdue')} tone={StatusTone.Danger} /> : null}
                    </span>
                  </span>
                  <ChevronRight className="size-5 shrink-0 text-muted" aria-hidden />
                </Link>
              </li>
            );
          })}
        </ul>
      </Card>
    </Section>
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
          {dashboard.data.upcoming.length > 0 ? <ComingUp items={dashboard.data.upcoming} /> : null}
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
