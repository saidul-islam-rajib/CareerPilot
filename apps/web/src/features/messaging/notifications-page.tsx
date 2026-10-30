'use client';

import Link from 'next/link';
import { Bell, BriefcaseBusiness, CheckCheck, MessageCircle, Plug, type LucideIcon } from 'lucide-react';
import type { AppNotification } from '@careerpilot/api-client';
import { useFormat, useNotifications, useReadNotifications, useT } from '@careerpilot/client-core';
import { NotificationTarget } from '@careerpilot/domain-ui-logic';
import { Button, Card, EmptyState, ErrorState, LoadingState, PageHeader, cn } from '@careerpilot/ui-web';
import { Routes } from '@/core/routes';

const HREFS: Record<NotificationTarget, (id: string) => string> = {
  [NotificationTarget.Conversation]: Routes.conversation,
  [NotificationTarget.Application]: Routes.application,
  [NotificationTarget.Integration]: () => Routes.connectedAccounts,
};

const GLYPHS: Record<NotificationTarget, LucideIcon> = {
  [NotificationTarget.Conversation]: MessageCircle,
  [NotificationTarget.Application]: BriefcaseBusiness,
  [NotificationTarget.Integration]: Plug,
};

export function notificationHref(notification: AppNotification): string {
  return HREFS[notification.target](notification.targetId);
}

export function NotificationsPage() {
  const t = useT();
  const format = useFormat();
  const notifications = useNotifications();
  const read = useReadNotifications();
  if (notifications.isPending) {
    return <LoadingState />;
  }
  if (notifications.isError) {
    return <ErrorState onRetry={() => void notifications.refetch()} />;
  }
  const unread = notifications.data.some((n) => !n.read);
  return (
    <>
      <PageHeader
        title={t('notifications.title')}
        actions={
          unread ? (
            <Button variant="outline" icon={CheckCheck} loading={read.isPending} onClick={() => read.mutate(undefined)}>
              {t('notifications.markAllRead')}
            </Button>
          ) : null
        }
      />
      {notifications.data.length === 0 ? (
        <EmptyState body={t('notifications.empty')} />
      ) : (
        <Card className="p-2">
          <ul className="divide-y divide-border">
            {notifications.data.map((notification) => {
              const Glyph = GLYPHS[notification.target];
              return (
                <li key={notification.id}>
                  <Link
                    href={notificationHref(notification)}
                    onClick={() => read.mutate([notification.id])}
                    className={cn(
                      'flex items-start gap-3 rounded-control px-2 py-3 hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus',
                      notification.read ? undefined : 'bg-primary-subtle/40',
                    )}
                  >
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-subtle text-primary">
                      <Glyph className="size-5" aria-hidden />
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className={cn('text-foreground', notification.read ? 'font-medium' : 'font-bold')}>{notification.title}</span>
                      <span className="text-sm text-muted">{notification.body}</span>
                      <span className="text-xs text-muted">{format.dateTime(notification.createdAt)}</span>
                    </span>
                    {notification.read ? null : <Bell className="size-4 shrink-0 text-primary" aria-hidden />}
                  </Link>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </>
  );
}
