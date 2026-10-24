'use client';

import { OctagonX } from 'lucide-react';
import { useEnumDisplay, useFormat, useT } from '@careerpilot/client-core';
import { EnumKey, StatusTone } from '@careerpilot/domain-ui-logic';
import { Banner, BarChart, Breakdown, Card, EnumBadge, ErrorState, LoadingState, MetricTile, PageHeader, Section } from '@careerpilot/ui-web';
import { useDashboard } from '@/core/admin-queries';

const MONTH_DAY_LENGTH = 5;

export function DashboardPage() {
  const t = useT();
  const format = useFormat();
  const display = useEnumDisplay();
  const dashboard = useDashboard();

  if (dashboard.isPending) {
    return <LoadingState />;
  }
  if (dashboard.isError) {
    return <ErrorState onRetry={() => void dashboard.refetch()} />;
  }
  const d = dashboard.data;
  const breakdown = (enumKey: EnumKey, items: { key: string; count: number }[]) =>
    items.map((item) => ({ key: item.key, label: display(enumKey, item.key).label, value: item.count }));

  return (
    <>
      <PageHeader title={t('admin.dashboard.title')} description={t('admin.dashboard.generated', { date: format.dateTime(d.generatedAt) })} />
      {d.emergencyStop.active ? (
        <Banner
          tone={StatusTone.Danger}
          icon={OctagonX}
          title={t('admin.settings.stopActive', { date: d.emergencyStop.since ? format.dateTime(d.emergencyStop.since) : '', reason: d.emergencyStop.reason ?? '' })}
        />
      ) : null}

      <Section title={t('admin.dashboard.users')}>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <MetricTile label={t('admin.dashboard.totalUsers')} value={d.users.total} />
          <MetricTile label={t('admin.dashboard.newThisWeek')} value={d.users.newThisWeek} />
          <MetricTile label={t('admin.dashboard.active')} value={d.users.active} />
          <MetricTile label={t('admin.dashboard.automaticEnabled')} value={d.users.automaticEnabled} />
          <MetricTile label={t('admin.dashboard.paused')} value={d.users.paused} tone="warning" />
          <MetricTile label={t('admin.dashboard.suspended')} value={d.users.suspended} tone="danger" />
          <MetricTile label={t('admin.dashboard.pendingDeletion')} value={d.users.pendingDeletion} tone="warning" />
          <MetricTile label={t('admin.dashboard.incompleteProfiles')} value={d.users.incompleteProfiles} />
        </div>
      </Section>

      <Section title={t('admin.dashboard.applications')}>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <MetricTile label={t('admin.dashboard.totalApplications')} value={d.applications.total} />
          <MetricTile label={t('admin.dashboard.approvalsWaiting')} value={d.applications.approvalsWaiting} />
          <MetricTile label={t('admin.dashboard.failures')} value={d.applications.failures} tone="danger" />
          <MetricTile label={t('admin.dashboard.outcomeUnknown')} value={d.applications.outcomeUnknown} tone="warning" />
        </div>
        <div className="grid gap-4 xl:grid-cols-2">
          <Card>
            <BarChart
              title={t('admin.dashboard.perDay')}
              data={d.applications.perDay.map((p) => ({ label: p.date, value: p.count }))}
              formatLabel={(label) => label.slice(-MONTH_DAY_LENGTH)}
            />
          </Card>
          <Card>
            <Breakdown title={t('admin.dashboard.bySubmission')} items={breakdown(EnumKey.SubmissionStatus, d.applications.bySubmissionStatus)} />
          </Card>
          <Card>
            <Breakdown title={t('admin.dashboard.byOutcome')} items={breakdown(EnumKey.OutcomeStatus, d.applications.byOutcomeStatus)} />
          </Card>
          <Card>
            <Breakdown title={t('admin.dashboard.byMode')} items={breakdown(EnumKey.ApplicationMode, d.applications.byMode)} />
          </Card>
        </div>
      </Section>

      <div className="grid gap-6 xl:grid-cols-3">
        <Section title={t('admin.dashboard.opportunities')}>
          <div className="grid grid-cols-2 gap-3">
            <MetricTile label={t('admin.dashboard.discovered')} value={d.opportunities.discovered} />
            <MetricTile label={t('admin.dashboard.flagged')} value={d.opportunities.flagged} tone="danger" />
            <MetricTile label={t('admin.dashboard.expired')} value={d.opportunities.expired} />
            <MetricTile label={t('admin.dashboard.archivedCirculars')} value={d.opportunities.archivedCirculars} />
          </div>
        </Section>
        <Section title={t('admin.dashboard.sources')}>
          <div className="grid grid-cols-2 gap-3">
            <MetricTile label={t('admin.dashboard.healthy')} value={d.sources.healthy} />
            <MetricTile label={t('admin.dashboard.degraded')} value={d.sources.degraded} tone="warning" />
            <MetricTile label={t('admin.dashboard.failing')} value={d.sources.failing} tone="danger" />
            <MetricTile label={t('admin.dashboard.disabled')} value={d.sources.disabled} />
          </div>
        </Section>
        <Section title={t('admin.dashboard.notifications')}>
          <div className="grid grid-cols-2 gap-3">
            <MetricTile label={t('admin.dashboard.sent')} value={d.notifications.sent} />
            <MetricTile label={t('admin.dashboard.delivered')} value={d.notifications.delivered} />
            <MetricTile label={t('admin.dashboard.failed')} value={d.notifications.failed} tone="danger" />
          </div>
        </Section>
      </div>

      <Section title={t('admin.dashboard.health')}>
        <Card>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {d.health.map((item) => (
              <li key={item.service} className="flex items-center justify-between gap-2 text-sm">
                <span className="font-medium">{item.service}</span>
                <EnumBadge enumKey={EnumKey.ServiceHealth} value={item.status} />
              </li>
            ))}
          </ul>
        </Card>
      </Section>
    </>
  );
}
