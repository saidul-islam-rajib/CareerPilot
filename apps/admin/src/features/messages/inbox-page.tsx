'use client';

import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { useFormat, useT } from '@careerpilot/client-core';
import { Badge, Card, EmptyState, ErrorState, ListRow, LoadingState, PageHeader, cn } from '@careerpilot/ui-web';
import { adminKeys } from '@/core/admin-queries';
import { useAdminApi, useAdminServices } from '@/core/admin-services';
import { AdminRoutes } from '@/core/routes';
import { TeamMessagesPanel } from '@/features/users/user-messages';

const MILLISECONDS_PER_SECOND = 1000;
const MARK_READ_SETTLE_MS = 800;
const USER_PARAM = 'user';

export function InboxPage() {
  const t = useT();
  const api = useAdminApi();
  const format = useFormat();
  const client = useQueryClient();
  const { config } = useAdminServices();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string>();
  useEffect(() => {
    setSelected(new URLSearchParams(window.location.search).get(USER_PARAM) ?? undefined);
  }, []);
  useEffect(() => {
    if (!selected) {
      return undefined;
    }
    const timer = setTimeout(() => void client.invalidateQueries({ queryKey: ['admin', 'messages'] }), MARK_READ_SETTLE_MS);
    return () => clearTimeout(timer);
  }, [selected, client]);
  const inbox = useQuery({
    queryKey: adminKeys.inbox(search),
    queryFn: () => api.messages.inbox(search),
    refetchInterval: config.messaging.pollSeconds * MILLISECONDS_PER_SECOND,
    placeholderData: (previous) => previous,
  });

  return (
    <>
      <PageHeader title={t('admin.inbox.title')} description={t('admin.inbox.description')} />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        <div className="flex flex-col gap-3">
          <label className="relative flex items-center">
            <span className="sr-only">{t('admin.search')}</span>
            <Search className="pointer-events-none absolute left-3 size-4 text-muted" aria-hidden />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('admin.inbox.searchPlaceholder')}
              className="min-h-11 w-full rounded-control border border-input bg-background pl-9 pr-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
            />
          </label>
          {inbox.isPending ? <LoadingState /> : null}
          {inbox.isError ? <ErrorState onRetry={() => void inbox.refetch()} /> : null}
          {inbox.data && inbox.data.length === 0 ? <EmptyState body={t('admin.inbox.empty')} /> : null}
          {inbox.data && inbox.data.length > 0 ? (
            <Card className="p-0">
              {inbox.data.map((row) => (
                <button
                  key={row.id}
                  type="button"
                  onClick={() => setSelected(row.otherMemberId)}
                  aria-current={row.otherMemberId === selected ? 'true' : undefined}
                  className={cn('w-full text-left', row.otherMemberId === selected ? 'bg-primary-subtle' : 'hover:bg-surface')}
                >
                  <ListRow
                    title={row.title}
                    subtitle={`${row.lastMessagePreview}${row.lastMessageAt ? ` · ${format.ago(row.lastMessageAt)}` : ''}`}
                    trailing={row.unreadCount > 0 ? <Badge label={t('admin.inbox.unread', { count: row.unreadCount })} /> : undefined}
                  />
                </button>
              ))}
            </Card>
          ) : null}
        </div>
        <div className="flex min-w-0 flex-col gap-3">
          {selected ? (
            <>
              <a href={AdminRoutes.user(selected)} className="self-start text-sm font-medium text-primary underline">
                {t('admin.inbox.openUser')}
              </a>
              <TeamMessagesPanel key={selected} userId={selected} />
            </>
          ) : (
            <EmptyState body={t('admin.inbox.pick')} />
          )}
        </div>
      </div>
    </>
  );
}
