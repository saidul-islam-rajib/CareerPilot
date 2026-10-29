'use client';

import type { PropsWithChildren } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Bell, Briefcase, CircleCheckBig, House, Menu, MessageCircle, UserRound, type LucideIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback } from 'react';
import type { AppNotification } from '@careerpilot/api-client';
import { useApprovals, useInbox, useNewNotifications, useT } from '@careerpilot/client-core';
import { BrandLockup, BrandMark, TeamSoberCredit, cn, useToast } from '@careerpilot/ui-web';
import { teamSoberLogoSrc } from '@/core/brand-assets';
import { Routes } from '@/core/routes';
import { notificationHref } from '@/features/messaging/notifications-page';

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  badge?: number;
}

function isActive(pathname: string, href: string): boolean {
  return href === Routes.home ? pathname === href : pathname.startsWith(href);
}

function useNavItems(): NavItem[] {
  const t = useT();
  const approvals = useApprovals();
  const inbox = useInbox();
  return [
    { href: Routes.home, label: t('nav.home'), icon: House },
    { href: Routes.approvals, label: t('nav.approvals'), icon: CircleCheckBig, badge: approvals.data?.length },
    { href: Routes.messages, label: t('messaging.title'), icon: MessageCircle, badge: inbox.data?.unreadMessages },
    { href: Routes.applications, label: t('nav.applications'), icon: Briefcase },
    { href: Routes.profile, label: t('nav.profile'), icon: UserRound },
    { href: Routes.settings, label: t('nav.more'), icon: Menu },
  ];
}

function NotificationBell({ className }: { className?: string }) {
  const t = useT();
  const inbox = useInbox();
  const count = inbox.data?.unreadNotifications ?? 0;
  return (
    <Link
      href={Routes.inbox}
      aria-label={count ? t('notifications.bellUnread', { count }) : t('notifications.bell')}
      className={cn('relative flex size-11 items-center justify-center rounded-full text-foreground hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus', className)}
    >
      <Bell className="size-6" aria-hidden />
      {count ? <span className="absolute right-1 top-1 flex min-w-5 items-center justify-center rounded-pill bg-danger px-1 text-[11px] font-bold text-primary-foreground">{count}</span> : null}
    </Link>
  );
}

function useNotificationToasts() {
  const t = useT();
  const toast = useToast();
  const router = useRouter();
  const show = useCallback(
    (notification: AppNotification) =>
      toast.show({ message: `${notification.title}: ${notification.body}`, actionLabel: t('notifications.open'), onAction: () => router.push(notificationHref(notification)) }),
    [router, t, toast],
  );
  useNewNotifications(show);
}

function CountBadge({ value }: { value?: number }) {
  return value ? <span className="ml-auto rounded-pill bg-accent px-2 text-xs font-bold text-accent-foreground">{value}</span> : null;
}

export function AppShell({ children }: PropsWithChildren) {
  const pathname = usePathname();
  const items = useNavItems();
  const t = useT();
  useNotificationToasts();
  return (
    <div className="flex min-h-dvh">
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-border bg-background p-4 lg:flex">
        <div className="mb-6 flex items-center justify-between gap-2 px-2">
          <Link href={Routes.home}>
            <BrandLockup />
          </Link>
          <NotificationBell />
        </div>
        <nav aria-label={t('nav.more')} className="flex flex-1 flex-col gap-1">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive(pathname, item.href) ? 'page' : undefined}
              className={cn(
                'flex min-h-11 items-center gap-3 rounded-control px-3 font-medium',
                isActive(pathname, item.href) ? 'bg-primary-subtle text-primary' : 'text-foreground hover:bg-surface',
              )}
            >
              <item.icon className="size-5" aria-hidden />
              {item.label}
              <CountBadge value={item.badge} />
            </Link>
          ))}
        </nav>
        <TeamSoberCredit logoSrc={teamSoberLogoSrc} compact />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-border bg-background px-4 py-3 lg:hidden">
          <Link href={Routes.home} aria-label={t('app.name')}>
            <BrandMark className="size-8" />
          </Link>
          <span className="text-lg font-bold">{t('app.name')}</span>
          <NotificationBell className="ml-auto" />
        </header>
        <main className="mx-auto flex w-full min-w-0 max-w-5xl flex-1 flex-col gap-6 px-4 py-6 pb-28 [overflow-wrap:anywhere] md:px-8 lg:pb-10">{children}</main>
        <footer className="hidden justify-center border-t border-border py-4 lg:flex">
          <TeamSoberCredit logoSrc={teamSoberLogoSrc} compact />
        </footer>
      </div>

      <nav aria-label={t('nav.more')} className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-6 border-t border-border bg-background pb-[env(safe-area-inset-bottom)] lg:hidden">
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive(pathname, item.href) ? 'page' : undefined}
            className={cn('relative flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs font-medium', isActive(pathname, item.href) ? 'text-primary' : 'text-muted')}
          >
            <item.icon className="size-6" aria-hidden />
            {item.label}
            {item.badge ? <span className="absolute right-1/4 top-1 rounded-pill bg-accent px-1.5 text-[10px] font-bold text-accent-foreground">{item.badge}</span> : null}
          </Link>
        ))}
      </nav>
    </div>
  );
}
