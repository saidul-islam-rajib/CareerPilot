'use client';

import type { PropsWithChildren } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Briefcase, Database, FileSearch, LayoutDashboard, LogOut, ScrollText, Settings, ShieldCheck, Users, type LucideIcon } from 'lucide-react';
import { can } from '@careerpilot/api-client';
import { useEnumDisplay, useT } from '@careerpilot/client-core';
import { AdminArea, EnumKey, PermissionAction } from '@careerpilot/domain-ui-logic';
import { BrandMark, Button, TeamSoberCredit, cn } from '@careerpilot/ui-web';
import { useAdminSession } from '@/core/admin-session';
import { teamSoberLogoSrc } from '@/core/brand-assets';
import { AdminRoutes } from '@/core/routes';

interface NavItem {
  href: string;
  area: AdminArea;
  icon: LucideIcon;
}

const NAV: NavItem[] = [
  { href: AdminRoutes.dashboard, area: AdminArea.Dashboard, icon: LayoutDashboard },
  { href: AdminRoutes.users, area: AdminArea.Users, icon: Users },
  { href: AdminRoutes.opportunities, area: AdminArea.Opportunities, icon: FileSearch },
  { href: AdminRoutes.sources, area: AdminArea.Sources, icon: Database },
  { href: AdminRoutes.applications, area: AdminArea.Applications, icon: Briefcase },
  { href: AdminRoutes.settings, area: AdminArea.Settings, icon: Settings },
  { href: AdminRoutes.audit, area: AdminArea.Audit, icon: ScrollText },
  { href: AdminRoutes.admins, area: AdminArea.Admins, icon: ShieldCheck },
];

function isActive(pathname: string, href: string) {
  return href === AdminRoutes.dashboard ? pathname === href : pathname.startsWith(href);
}

export function AdminShell({ children }: PropsWithChildren) {
  const t = useT();
  const pathname = usePathname();
  const display = useEnumDisplay();
  const { admin, permissions, end } = useAdminSession();
  const items = NAV.filter((item) => can(permissions, item.area, PermissionAction.Read));
  const links = (className: string) =>
    items.map((item) => (
      <Link
        key={item.href}
        href={item.href}
        aria-current={isActive(pathname, item.href) ? 'page' : undefined}
        className={cn(className, isActive(pathname, item.href) ? 'bg-primary-subtle text-primary' : 'text-foreground hover:bg-surface')}
      >
        <item.icon className="size-5 shrink-0" aria-hidden />
        {t(`admin.nav.${item.area}`)}
      </Link>
    ));

  return (
    <div className="flex min-h-dvh">
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col gap-4 border-r border-border bg-background p-4 lg:flex">
        <Link href={AdminRoutes.dashboard} className="flex items-center gap-3 px-2">
          <BrandMark />
          <span className="text-lg font-bold">{t('admin.appName')}</span>
        </Link>
        <nav aria-label={t('admin.appName')} className="flex flex-1 flex-col gap-1">
          {links('flex min-h-11 items-center gap-3 rounded-control px-3 text-sm font-medium')}
        </nav>
        <TeamSoberCredit logoSrc={teamSoberLogoSrc} compact />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex flex-wrap items-center gap-3 border-b border-border bg-background px-4 py-3 md:px-8">
          <BrandMark className="size-8 lg:hidden" />
          <span className="flex-1 text-sm text-muted">
            {admin ? t('admin.signedInAs', { name: admin.fullName, role: display(EnumKey.AdminRole, admin.role).label }) : null}
          </span>
          <Button variant="outline" size="sm" icon={LogOut} onClick={() => void end()}>
            {t('auth.signOut')}
          </Button>
        </header>
        <nav aria-label={t('admin.appName')} className="flex gap-1 overflow-x-auto border-b border-border bg-background px-2 py-2 lg:hidden">
          {links('flex shrink-0 items-center gap-2 rounded-control px-3 py-2 text-sm font-medium')}
        </nav>
        <main className="flex w-full flex-1 flex-col gap-6 px-4 py-6 md:px-8">{children}</main>
        <footer className="flex justify-center border-t border-border py-4 lg:hidden">
          <TeamSoberCredit logoSrc={teamSoberLogoSrc} compact />
        </footer>
      </div>
    </div>
  );
}
