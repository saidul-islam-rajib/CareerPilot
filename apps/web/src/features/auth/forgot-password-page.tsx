'use client';

import Link from 'next/link';
import { ArrowLeft, MailCheck } from 'lucide-react';
import { usePasswordReset, useT } from '@careerpilot/client-core';
import { StatusTone } from '@careerpilot/domain-ui-logic';
import { Banner, BrandLockup, Button, Card, TextField, buttonVariants } from '@careerpilot/ui-web';
import { Routes } from '@/core/routes';

export function ForgotPasswordPage() {
  const t = useT();
  const form = usePasswordReset();
  return (
    <>
      <BrandLockup />
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold">{t('auth.resetTitle')}</h1>
        <p className="text-muted">{t('auth.resetIntro')}</p>
      </div>
      {form.sent ? <Banner tone={StatusTone.Success} icon={MailCheck} title={t('auth.resetSent', { email: form.email })} /> : null}
      <Card>
        <form
          className="flex flex-col gap-4"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            form.submit();
          }}
        >
          <TextField label={t('auth.email')} type="email" autoComplete="email" value={form.email} onChange={(e) => form.setEmail(e.target.value)} error={form.error} />
          <Button type="submit" variant={form.sent ? 'secondary' : 'primary'} fullWidth loading={form.submitting}>
            {t('auth.sendResetLink')}
          </Button>
        </form>
      </Card>
      <Link href={Routes.signIn} className={buttonVariants({ variant: form.sent ? 'primary' : 'ghost', fullWidth: true })}>
        <ArrowLeft className="size-5" aria-hidden />
        {t('accountLinks.backToSignIn')}
      </Link>
    </>
  );
}
