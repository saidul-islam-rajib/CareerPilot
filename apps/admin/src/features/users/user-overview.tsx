'use client';

import { useQuery } from '@tanstack/react-query';
import { Mail, Phone } from 'lucide-react';
import { useFormat, useT } from '@careerpilot/client-core';
import { ContactKind } from '@careerpilot/domain-ui-logic';
import { Badge, Card, EmptyState, ErrorState, ListRow, LoadingState } from '@careerpilot/ui-web';
import { adminKeys } from '@/core/admin-queries';
import { useAdminApi } from '@/core/admin-services';

export function ContactsCard({ userId }: { userId: string }) {
  const t = useT();
  const api = useAdminApi();
  const files = useQuery({ queryKey: [...adminKeys.user(userId), 'files'], queryFn: () => api.users.files(userId) });
  if (files.isPending) {
    return <LoadingState />;
  }
  if (files.isError) {
    return <ErrorState onRetry={() => void files.refetch()} />;
  }
  const contacts = files.data.contacts;
  const hasPhone = contacts.some((c) => c.kind === ContactKind.Phone);
  return (
    <Card>
      {contacts.map((contact) => (
        <ListRow
          key={`${contact.kind}-${contact.value}`}
          icon={contact.kind === ContactKind.Phone ? Phone : Mail}
          title={contact.value}
          subtitle={contact.label}
          trailing={
            <span className="flex gap-2">
              {contact.primary ? <Badge label={t('admin.users.primaryContact')} /> : null}
              <Badge label={contact.verified ? t('admin.users.verifiedContact') : t('admin.users.unverifiedContact')} />
            </span>
          }
        />
      ))}
      {hasPhone ? null : <ListRow icon={Phone} title={t('admin.users.noPhone')} />}
    </Card>
  );
}

function Group({ title, empty, children }: { title: string; empty: string; children: React.ReactNode[] }) {
  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      {children.length === 0 ? <EmptyState body={empty} /> : <Card>{children}</Card>}
    </section>
  );
}

export function OverviewPanel({ userId }: { userId: string }) {
  const t = useT();
  const api = useAdminApi();
  const format = useFormat();
  const overview = useQuery({ queryKey: [...adminKeys.user(userId), 'overview'], queryFn: () => api.users.overview(userId) });
  if (overview.isPending) {
    return <LoadingState />;
  }
  if (overview.isError) {
    return <ErrorState onRetry={() => void overview.refetch()} />;
  }
  const data = overview.data;
  const label = (group: string, value: string) => t(`enums.${group}.${value}`);
  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <Group title={t('admin.records.overview.government')} empty={t('admin.records.overview.noGovernment')}>
        {data.governmentApplications.map((item) => (
          <ListRow
            key={item.id}
            title={item.circularTitle}
            subtitle={[
              t('admin.records.overview.governmentRow', { status: label('gov_application_status', item.status), fee: label('fee_status', item.feeStatus), stages: item.stages }),
              item.secretsPresent.length ? t('admin.records.overview.secretsHeld', { kinds: item.secretsPresent.map((kind) => label('secret_kind', kind)).join(', ') }) : '',
            ]
              .filter(Boolean)
              .join(' · ')}
          />
        ))}
      </Group>
      <Group title={t('admin.records.overview.drafts')} empty={t('admin.records.overview.noDrafts')}>
        {data.writingDrafts.map((draft) => (
          <ListRow
            key={draft.id}
            title={draft.title}
            subtitle={`${draft.organization} · ${t('admin.records.overview.draftRow', { kind: label('writing_kind', draft.kind), version: draft.version, words: draft.wordCount })}`}
            trailing={<Badge label={label('draft_status', draft.status)} />}
          />
        ))}
      </Group>
      <Group title={t('admin.records.overview.rules')} empty={t('admin.records.overview.noRules')}>
        {data.automationRules.map((rule) => (
          <ListRow
            key={rule.id}
            title={rule.name}
            subtitle={t('admin.records.overview.ruleRow', { state: rule.enabled ? t('admin.records.overview.ruleOn') : t('admin.records.overview.ruleOff'), count: rule.limits.dailyCap ?? '-' })}
          />
        ))}
      </Group>
      <Group title={t('admin.records.overview.exports')} empty={t('admin.records.overview.noExports')}>
        {data.exports.map((item) => (
          <ListRow
            key={item.id}
            title={t('admin.records.overview.exportRow', { kind: label('export_kind', item.kind), format: label('export_format', item.format), date: format.date(item.requestedAt) })}
            trailing={<Badge label={label('export_status', item.status)} />}
          />
        ))}
      </Group>
      <Group title={t('admin.records.overview.deletion')} empty={t('admin.records.overview.noDeletion')}>
        {data.deletion
          ? [
              <ListRow
                key={data.deletion.id}
                title={t('admin.records.overview.deletionRow', { requested: format.date(data.deletion.requestedAt), scheduled: format.date(data.deletion.scheduledFor) })}
                trailing={<Badge label={label('deletion_status', data.deletion.status)} />}
              />,
            ]
          : []}
      </Group>
      <Group title={t('admin.records.overview.notifications', { unread: data.unreadNotifications })} empty={t('admin.records.overview.noNotifications')}>
        {data.notifications.map((item) => (
          <ListRow
            key={item.id}
            title={item.title}
            subtitle={`${label('notification_kind', item.kind)} · ${format.dateTime(item.createdAt)}`}
            trailing={item.read ? undefined : <Badge label={t('admin.inbox.unread', { count: 1 })} />}
          />
        ))}
      </Group>
    </div>
  );
}
