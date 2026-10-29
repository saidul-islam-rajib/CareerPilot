'use client';

import Link from 'next/link';
import {
  ArrowRight,
  Archive,
  BadgeCheck,
  Building2,
  CircleCheckBig,
  Clock,
  FileSearch,
  KeyRound,
  Lightbulb,
  MapPin,
  OctagonX,
  PauseCircle,
  Route,
  Send,
  ShieldCheck,
  Sparkles,
  UserRound,
  type LucideIcon,
} from 'lucide-react';
import { useT } from '@careerpilot/client-core';
import { BrandMark, TeamSoberCredit, buttonVariants, cn } from '@careerpilot/ui-web';
import { teamSoberLogoSrc } from '@/core/brand-assets';
import { Routes } from '@/core/routes';

const PREVIEW_JOBS = ['first', 'second', 'third'] as const;
const PREVIEW_SKILLS = ['first', 'second', 'third'] as const;
const TRUST: { key: string; icon: LucideIcon }[] = [
  { key: 'approve', icon: BadgeCheck },
  { key: 'facts', icon: ShieldCheck },
  { key: 'proof', icon: Archive },
];
const HIGHLIGHTS: { key: string; icon: LucideIcon }[] = [
  { key: 'reasons', icon: FileSearch },
  { key: 'skills', icon: Lightbulb },
  { key: 'companies', icon: Building2 },
  { key: 'focus', icon: MapPin },
  { key: 'control', icon: PauseCircle },
  { key: 'proof', icon: Archive },
];
const STEPS: { key: string; icon: LucideIcon }[] = [
  { key: 'profile', icon: UserRound },
  { key: 'tracks', icon: Route },
  { key: 'review', icon: FileSearch },
  { key: 'apply', icon: Send },
];
const PROMISES: { key: string; icon: LucideIcon }[] = [
  { key: 'facts', icon: UserRound },
  { key: 'captcha', icon: ShieldCheck },
  { key: 'duplicate', icon: Clock },
  { key: 'secrets', icon: KeyRound },
];

function TopBar() {
  const t = useT();
  return (
    <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
      <Link href={Routes.welcome} className="flex items-center gap-2 rounded-control focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus">
        <BrandMark className="size-9" />
        <span className="text-lg font-bold tracking-tight text-foreground">{t('app.name')}</span>
      </Link>
      <nav className="flex items-center gap-2">
        <Link href={Routes.signIn} className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
          {t('auth.signIn')}
        </Link>
        <Link href={Routes.register} className={cn(buttonVariants({ size: 'sm' }), 'hidden sm:inline-flex')}>
          {t('auth.createAccount')}
        </Link>
      </nav>
    </header>
  );
}

function ProductPreview() {
  const t = useT();
  return (
    <div className="relative mx-auto w-full max-w-md lg:max-w-none" role="img" aria-label={t('welcome.preview.label')}>
      <div aria-hidden className="absolute -right-6 -top-8 size-48 rounded-full bg-primary-subtle blur-3xl" />
      <div aria-hidden className="absolute -bottom-10 -left-8 size-56 rounded-full bg-accent opacity-20 blur-3xl" />
      <div aria-hidden className="relative flex flex-col gap-3 rounded-card border border-border bg-card p-4 shadow-xl sm:p-5">
        <div className="flex items-center justify-between">
          <span className="text-lg font-bold text-foreground">{t('welcome.preview.heading')}</span>
          <span className="rounded-pill bg-primary-subtle px-3 py-1 text-xs font-semibold text-primary">{t('welcome.preview.track')}</span>
        </div>
        {PREVIEW_JOBS.map((job, index) => (
          <div key={job} className={cn('flex flex-col gap-2 rounded-control border p-3', index === 0 ? 'border-primary bg-primary-subtle/40' : 'border-border bg-background')}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-semibold text-foreground">{t(`welcome.preview.jobs.${job}.title`)}</p>
                <p className="flex items-center gap-1 truncate text-xs text-muted">
                  <Building2 className="size-3.5 shrink-0" />
                  {t(`welcome.preview.jobs.${job}.company`)} · {t(`welcome.preview.jobs.${job}.place`)}
                </p>
              </div>
              <span className={cn('shrink-0 rounded-pill px-2 py-0.5 text-xs font-semibold', index === 0 ? 'bg-success-subtle text-success' : 'bg-primary-subtle text-primary')}>
                {t(`welcome.preview.jobs.${job}.score`)}
              </span>
            </div>
            {index === 0 ? (
              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                <span className="text-muted">{t('welcome.preview.skillsLabel')}</span>
                {PREVIEW_SKILLS.map((skill) => (
                  <span key={skill} className="rounded-pill border border-dashed border-input bg-card px-2 py-0.5 font-medium text-foreground">
                    {t(`welcome.preview.skills.${skill}`)}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        ))}
      </div>
      <div aria-hidden className="relative -mt-6 ml-auto mr-2 flex w-64 items-center gap-3 rounded-card border border-border bg-card p-3 shadow-lg sm:-mr-6">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-success-subtle text-success">
          <CircleCheckBig className="size-5" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">{t('welcome.preview.sentTitle')}</p>
          <p className="truncate text-xs text-muted">{t('welcome.preview.sentBody')}</p>
        </div>
      </div>
      <div aria-hidden className="relative -mt-2 ml-2 hidden w-60 items-center gap-3 rounded-card border border-border bg-card p-3 shadow-lg sm:-ml-6 sm:flex">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-warning-subtle text-warning">
          <BadgeCheck className="size-5" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">{t('welcome.preview.approvalTitle')}</p>
          <p className="truncate text-xs text-muted">{t('welcome.preview.approvalBody')}</p>
        </div>
      </div>
    </div>
  );
}

function Hero() {
  const t = useT();
  return (
    <section className="mx-auto grid w-full max-w-6xl items-center gap-12 px-4 pb-16 pt-6 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:pb-24 lg:pt-12">
      <div className="flex flex-col gap-6">
        <span className="inline-flex w-fit items-center gap-2 rounded-pill border border-border bg-card px-3 py-1.5 text-sm font-medium text-muted shadow-sm">
          <Sparkles className="size-4 text-primary" aria-hidden />
          {t('welcome.eyebrow')}
        </span>
        <h1 className="text-4xl font-extrabold leading-tight tracking-tight text-foreground sm:text-5xl lg:text-6xl">
          {t('welcome.titleLead')} <span className="text-primary">{t('welcome.titleAccent')}</span>
        </h1>
        <p className="max-w-xl text-lg leading-relaxed text-muted">{t('welcome.body')}</p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Link href={Routes.register} className={cn(buttonVariants(), 'min-h-12 px-6 text-base')}>
            {t('welcome.primaryCta')}
            <ArrowRight className="size-5" aria-hidden />
          </Link>
          <Link href={Routes.signIn} className={cn(buttonVariants({ variant: 'outline' }), 'min-h-12 px-6 text-base')}>
            {t('welcome.secondaryCta')}
          </Link>
        </div>
        <ul className="flex flex-col gap-2 text-sm text-foreground sm:flex-row sm:flex-wrap sm:gap-x-5">
          {TRUST.map(({ key, icon: Glyph }) => (
            <li key={key} className="flex items-center gap-2">
              <Glyph className="size-4 shrink-0 text-success" aria-hidden />
              {t(`welcome.trust.${key}`)}
            </li>
          ))}
        </ul>
      </div>
      <ProductPreview />
    </section>
  );
}

function Highlights() {
  const t = useT();
  return (
    <section aria-labelledby="highlights-title" className="border-y border-border bg-surface">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-16 sm:px-6 lg:py-20">
        <h2 id="highlights-title" className="max-w-2xl text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          {t('welcome.highlightsTitle')}
        </h2>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {HIGHLIGHTS.map(({ key, icon: Glyph }) => (
            <li key={key} className="flex flex-col gap-3 rounded-card border border-border bg-card p-6 transition-shadow hover:shadow-md">
              <span className="flex size-11 items-center justify-center rounded-control bg-primary-subtle text-primary">
                <Glyph className="size-5" aria-hidden />
              </span>
              <h3 className="text-lg font-semibold text-foreground">{t(`welcome.highlights.${key}.title`)}</h3>
              <p className="leading-relaxed text-muted">{t(`welcome.highlights.${key}.body`)}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function Steps() {
  const t = useT();
  return (
    <section aria-labelledby="steps-title" className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-16 sm:px-6 lg:py-20">
      <h2 id="steps-title" className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
        {t('welcome.stepsTitle')}
      </h2>
      <ol className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map(({ key, icon: Glyph }, index) => (
          <li key={key} className="relative flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <Glyph className="size-5" aria-hidden />
              </span>
              <span className="text-sm font-semibold uppercase tracking-wide text-primary">{t('welcome.stepLabel', { number: index + 1 })}</span>
            </div>
            <h3 className="text-lg font-semibold text-foreground">{t(`welcome.steps.${key}.title`)}</h3>
            <p className="leading-relaxed text-muted">{t(`welcome.steps.${key}.body`)}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

function Promises() {
  const t = useT();
  return (
    <section aria-labelledby="promise-title" className="mx-auto w-full max-w-6xl px-4 pb-16 sm:px-6 lg:pb-20">
      <div className="grid gap-8 rounded-card border border-border bg-card p-6 shadow-sm sm:p-10 lg:grid-cols-[1fr_1.2fr] lg:items-center">
        <div className="flex flex-col gap-3">
          <span className="flex size-12 items-center justify-center rounded-control bg-danger-subtle text-danger">
            <OctagonX className="size-6" aria-hidden />
          </span>
          <h2 id="promise-title" className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            {t('welcome.promiseTitle')}
          </h2>
          <p className="leading-relaxed text-muted">{t('welcome.promiseBody')}</p>
        </div>
        <ul className="grid gap-3 sm:grid-cols-2">
          {PROMISES.map(({ key, icon: Glyph }) => (
            <li key={key} className="flex items-start gap-3 rounded-control bg-surface p-4">
              <Glyph className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
              <span className="font-medium text-foreground">{t(`welcome.promises.${key}`)}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function Closing() {
  const t = useT();
  return (
    <section className="mx-auto w-full max-w-6xl px-4 pb-12 sm:px-6">
      <div className="flex flex-col items-start gap-6 rounded-card bg-primary p-8 text-primary-foreground sm:p-12 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex max-w-2xl flex-col gap-2">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">{t('welcome.closingTitle')}</h2>
          <p className="text-lg opacity-90">{t('welcome.closingBody')}</p>
        </div>
        <Link
          href={Routes.register}
          className={cn(buttonVariants({ variant: 'outline' }), 'min-h-12 shrink-0 border-primary-foreground bg-primary-foreground px-6 text-base text-primary hover:bg-primary-subtle')}
        >
          {t('auth.createAccount')}
          <ArrowRight className="size-5" aria-hidden />
        </Link>
      </div>
    </section>
  );
}

export function WelcomePage() {
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <TopBar />
      <main className="flex flex-1 flex-col">
        <Hero />
        <Highlights />
        <Steps />
        <Promises />
        <Closing />
      </main>
      <footer className="mx-auto flex w-full max-w-6xl justify-center px-4 pb-10 sm:px-6">
        <TeamSoberCredit logoSrc={teamSoberLogoSrc} compact />
      </footer>
    </div>
  );
}
