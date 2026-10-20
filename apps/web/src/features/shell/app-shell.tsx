'use client';

import type { PropsWithChildren } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Briefcase, CircleCheckBig, House, Menu, UserRound, type LucideIcon } from 'lucide-react';
import { useApprovals, useT } from '@careerpilot/client-core';
import { BrandLockup, BrandMark, TeamSoberCredit, cn } from '@careerpilot/ui-web';
import { teamSoberLogoSrc } from '@/core/brand-assets';
import { Routes } from '@/core/routes';

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
  return [
    { href: Routes.home, label: t('nav.home'), icon: House },
    { href: Routes.approvals, label: t('nav.approvals'), icon: CircleCheckBig, badge: approvals.data?.length },
    { href: Routes.applications, label: t('nav.applications'), icon: Briefcase },
    { href: Routes.profile, label: t('nav.profile'), icon: UserRound },
    { href: Routes.settings, label: t('nav.more'), icon: Menu },
  ];
}

function CountBadge({ value }: { value?: number }) {
  return value ? <span className="ml-auto rounded-pill bg-accent px-2 text-xs font-bold text-accent-foreground">{value}</span> : null;
}

export function AppShell({ children }: PropsWithChildren) {
  const pathname = usePathname();
  const items = useNavItems();
  const t = useT();
  return (
    <div className="flex min-h-dvh">
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-border bg-background p-4 lg:flex">
        <Link href={Routes.home} className="mb-6 px-2">
          <BrandLockup />
        </Link>
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
        </header>
        <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-6 pb-28 md:px-8 lg:pb-10">{children}</main>
        <footer className="hidden justify-center border-t border-border py-4 lg:flex">
          <TeamSoberCredit logoSrc={teamSoberLogoSrc} compact />
        </footer>
      </div>

      <nav aria-label={t('nav.more')} className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-border bg-background pb-[env(safe-area-inset-bottom)] lg:hidden">
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
