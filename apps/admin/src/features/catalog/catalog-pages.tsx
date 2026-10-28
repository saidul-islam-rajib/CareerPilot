'use client';

import { useState } from 'react';
import { AlertCircle, Plus } from 'lucide-react';
import { ApiErrorDetail, isApiError, type AdminApplicationRow, type AdminOpportunityRow, type AdminSourceRow, type AuditEntry } from '@careerpilot/api-client';
import { useFormat, useT } from '@careerpilot/client-core';
import { AdminArea, ActorType, EnumKey, OpportunityStatus, PermissionAction, SourceStatus, StatusTone, SubmissionStatus, enumValues } from '@careerpilot/domain-ui-logic';
import { Banner, Button, ConfirmDialog, EnumBadge } from '@careerpilot/ui-web';
import { useAdminMutation } from '@/core/admin-queries';
import { useAdminApi } from '@/core/admin-services';
import { useCan } from '@/core/admin-session';
import { ListPage } from '@/features/common/list-page';
import { AddSourceDialog, SuggestedSources, sourceProblemKey } from './source-forms';

const CANCELLABLE: readonly SubmissionStatus[] = [SubmissionStatus.ApprovedQueued, SubmissionStatus.AwaitingApproval];

export function sourceCheckErrorKey(error: unknown): string {
  return isApiError(error) && error.detail === ApiErrorDetail.SourceNotConfigured ? 'admin.sources.notConfigured' : 'admin.sources.checkFailed';
}

export function OpportunitiesPage() {
  const t = useT();
  const api = useAdminApi();
  const format = useFormat();
  const canUpdate = useCan(AdminArea.Opportunities, PermissionAction.Update);
  const flag = useAdminMutation((id: string) => api.opportunities.flagOpportunity(id, t('admin.opportunities.flagReason')));
  const expire = useAdminMutation((id: string) => api.opportunities.markExpired(id));
  return (
    <ListPage<AdminOpportunityRow>
      title={t('admin.opportunities.title')}
      resource="opportunities"
      fetcher={(query) => api.opportunities.listOpportunities(query)}
      rowKey={(o) => o.id}
      statusEnum={{ key: EnumKey.OpportunityStatus, values: enumValues(OpportunityStatus) }}
      columns={[
        {
          key: 'title',
          header: t('admin.columns.title'),
          cell: (o) => (
            <span className="flex flex-col">
              <span className="font-semibold">{o.title}</span>
              <span className="text-xs text-muted">{o.organization}</span>
            </span>
          ),
        },
        { key: 'type', header: t('admin.columns.type'), cell: (o) => <EnumBadge enumKey={EnumKey.OpportunityType} value={o.type} /> },
        { key: 'status', header: t('admin.columns.status'), cell: (o) => <EnumBadge enumKey={EnumKey.OpportunityStatus} value={o.status} /> },
        { key: 'country', header: t('admin.columns.country'), cell: (o) => o.countryCode },
        { key: 'discovered', header: t('admin.columns.discovered'), cell: (o) => format.date(o.discoveredAt) },
        {
          key: 'actions',
          header: t('admin.actions'),
          cell: (o) =>
            canUpdate && o.status === OpportunityStatus.Active ? (
              <span className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => flag.mutate(o.id)}>
                  {t('admin.opportunities.flag')}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => expire.mutate(o.id)}>
                  {t('admin.opportunities.expire')}
                </Button>
              </span>
            ) : null,
        },
      ]}
    />
  );
}

export function SourcesPage() {
  const t = useT();
  const api = useAdminApi();
  const format = useFormat();
  const canUpdate = useCan(AdminArea.Sources, PermissionAction.Update);
  const canCreate = useCan(AdminArea.Sources, PermissionAction.Create);
  const [adding, setAdding] = useState(false);
  const toggle = useAdminMutation(({ id, enabled }: { id: string; enabled: boolean }) => api.sources.setSourceEnabled(id, enabled));
  const check = useAdminMutation((id: string) => api.sources.runSourceCheck(id));
  return (
    <div className="flex flex-col gap-4">
      {check.error ? <Banner tone={StatusTone.Danger} icon={AlertCircle} title={t(sourceCheckErrorKey(check.error))} /> : null}
      {canCreate ? <SuggestedSources /> : null}
      {canCreate ? <AddSourceDialog open={adding} onOpenChange={setAdding} /> : null}
      <ListPage<AdminSourceRow>
        title={t('admin.sources.title')}
        resource="sources"
        aside={
          canCreate ? (
            <Button icon={Plus} onClick={() => setAdding(true)}>
              {t('admin.sources.add')}
            </Button>
          ) : null
        }
        fetcher={(query) => api.sources.listSources(query)}
        rowKey={(s) => s.id}
        statusEnum={{ key: EnumKey.SourceStatus, values: enumValues(SourceStatus) }}
        columns={[
          {
            key: 'name',
            header: t('admin.columns.source'),
            cell: (s) => (
              <span className="flex min-w-0 flex-col">
                <span className="font-semibold">{s.name}</span>
                {s.setup ? <span className="max-w-64 truncate text-xs text-muted">{s.setup.siteUrl || s.setup.url}</span> : null}
              </span>
            ),
          },
          {
            key: 'status',
            header: t('admin.columns.status'),
            cell: (s) => (
              <span className="flex flex-col gap-1">
                <EnumBadge enumKey={EnumKey.SourceStatus} value={s.status} />
                {s.lastError ? <span className="max-w-56 text-xs text-muted">{t(sourceProblemKey(s.lastError))}</span> : null}
              </span>
            ),
          },
          { key: 'lastSuccess', header: t('admin.columns.lastSuccess'), cell: (s) => (s.lastSuccessAt ? format.dateTime(s.lastSuccessAt) : t('admin.sources.never')) },
          { key: 'failures', header: t('admin.columns.failures'), cell: (s) => s.failuresLast24h, className: 'text-right tabular-nums' },
          { key: 'found', header: t('admin.columns.found'), cell: (s) => s.opportunitiesFound, className: 'text-right tabular-nums' },
          {
            key: 'actions',
            header: t('admin.actions'),
            cell: (s) =>
              canUpdate ? (
                <span className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => toggle.mutate({ id: s.id, enabled: !s.enabled })}>
                    {s.enabled ? t('admin.sources.disable') : t('admin.sources.enable')}
                  </Button>
                  <Button size="sm" variant="ghost" disabled={!s.enabled} onClick={() => check.mutate(s.id)}>
                    {t('admin.sources.check')}
                  </Button>
                </span>
              ) : null,
          },
        ]}
      />
    </div>
  );
}

export function ApplicationsPage() {
  const t = useT();
  const api = useAdminApi();
  const format = useFormat();
  const canUpdate = useCan(AdminArea.Applications, PermissionAction.Update);
  const cancel = useAdminMutation((id: string) => api.applications.cancelQueued(id, t('admin.applications.cancelReason')));
  return (
    <ListPage<AdminApplicationRow>
      title={t('admin.applications.title')}
      resource="applications"
      fetcher={(query) => api.applications.listApplications(query)}
      rowKey={(a) => a.id}
      statusEnum={{ key: EnumKey.SubmissionStatus, values: enumValues(SubmissionStatus) }}
      columns={[
        { key: 'user', header: t('admin.columns.user'), cell: (a) => <span className="font-semibold">{a.userName}</span> },
        {
          key: 'opportunity',
          header: t('admin.columns.opportunity'),
          cell: (a) => (
            <span className="flex flex-col">
              <span>{a.opportunityTitle}</span>
              <span className="text-xs text-muted">{a.organization}</span>
            </span>
          ),
        },
        { key: 'submission', header: t('admin.columns.submission'), cell: (a) => <EnumBadge enumKey={EnumKey.SubmissionStatus} value={a.submissionStatus} /> },
        { key: 'outcome', header: t('admin.columns.outcome'), cell: (a) => <EnumBadge enumKey={EnumKey.OutcomeStatus} value={a.outcomeStatus} /> },
        { key: 'mode', header: t('admin.columns.mode'), cell: (a) => <EnumBadge enumKey={EnumKey.ApplicationMode} value={a.mode} /> },
        { key: 'updated', header: t('admin.columns.updated'), cell: (a) => format.date(a.updatedAt) },
        {
          key: 'actions',
          header: t('admin.actions'),
          cell: (a) =>
            canUpdate && CANCELLABLE.includes(a.submissionStatus) ? (
              <ConfirmDialog
                title={t('admin.applications.confirmCancel')}
                body={t('admin.applications.confirmCancelBody')}
                confirmLabel={t('admin.applications.cancel')}
                destructive
                onConfirm={() => cancel.mutate(a.id)}
                trigger={
                  <Button size="sm" variant="outline">
                    {t('admin.applications.cancel')}
                  </Button>
                }
              />
            ) : null,
        },
      ]}
    />
  );
}

export function AuditPage() {
  const t = useT();
  const api = useAdminApi();
  const format = useFormat();
  return (
    <ListPage<AuditEntry>
      title={t('admin.audit.title')}
      description={t('admin.audit.body')}
      resource="audit"
      fetcher={(query) => api.audit.listAudit(query)}
      rowKey={(e) => e.id}
      statusEnum={{ key: EnumKey.ActorType, values: enumValues(ActorType) }}
      columns={[
        { key: 'time', header: t('admin.columns.time'), cell: (e) => format.dateTime(e.at) },
        {
          key: 'actor',
          header: t('admin.columns.actor'),
          cell: (e) => (
            <span className="flex items-center gap-2">
              {e.actorName}
              <EnumBadge enumKey={EnumKey.ActorType} value={e.actorType} />
            </span>
          ),
        },
        { key: 'action', header: t('admin.columns.action'), cell: (e) => <code className="text-xs">{e.action}</code> },
        { key: 'target', header: t('admin.columns.target'), cell: (e) => e.target },
      ]}
    />
  );
}
