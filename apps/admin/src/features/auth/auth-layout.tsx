'use client';

import type { PropsWithChildren } from 'react';
import { useT } from '@careerpilot/client-core';
import { BrandMark, TeamSoberCredit } from '@careerpilot/ui-web';
import { teamSoberLogoSrc } from '@/core/brand-assets';

export function AuthLayout({ children }: PropsWithChildren) {
  const t = useT();
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-6 px-4 py-10">
      <div className="flex items-center gap-3">
        <BrandMark className="size-12" />
        <span className="text-2xl font-bold">{t('admin.appName')}</span>
      </div>
      {children}
      <TeamSoberCredit logoSrc={teamSoberLogoSrc} compact />
    </main>
  );
}
