'use client';

import Link from 'next/link';
import { BadgeCheck, FileSearch, ShieldCheck } from 'lucide-react';
import { useT } from '@careerpilot/client-core';
import { BrandMark, TeamSoberCredit, buttonVariants } from '@careerpilot/ui-web';
import { teamSoberLogoSrc } from '@/core/brand-assets';
import { Routes } from '@/core/routes';

export function WelcomePage() {
  const t = useT();
  const points = [
    { icon: FileSearch, text: t('auth.pointMatches') },
    { icon: BadgeCheck, text: t('auth.pointApproval') },
    { icon: ShieldCheck, text: t('auth.pointRecord') },
  ];
  return (
    <div className="flex flex-1 flex-col justify-between gap-10">
      <div className="flex flex-col gap-6 pt-6">
        <BrandMark className="size-20" />
        <div className="flex flex-col gap-3">
          <h1 className="text-4xl font-bold">{t('auth.welcomeTitle')}</h1>
          <p className="text-lg text-muted">{t('auth.welcomeBody')}</p>
        </div>
        <ul className="flex flex-col gap-3">
          {points.map((point) => (
            <li key={point.text} className="flex items-center gap-3 font-semibold">
              <span className="rounded-control bg-primary-subtle p-2 text-primary">
                <point.icon className="size-5" aria-hidden />
              </span>
              {point.text}
            </li>
          ))}
        </ul>
      </div>
      <div className="flex flex-col gap-3">
        <Link href={Routes.register} className={buttonVariants({ fullWidth: true })}>
          {t('auth.createAccount')}
        </Link>
        <Link href={Routes.signIn} className={buttonVariants({ variant: 'outline', fullWidth: true })}>
          {t('auth.signIn')}
        </Link>
        <TeamSoberCredit logoSrc={teamSoberLogoSrc} compact />
      </div>
    </div>
  );
}
