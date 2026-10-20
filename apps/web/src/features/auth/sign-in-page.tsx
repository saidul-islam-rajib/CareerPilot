'use client';

import Link from 'next/link';
import { AlertCircle } from 'lucide-react';
import { useSignInForm, useT } from '@careerpilot/client-core';
import { StatusTone } from '@careerpilot/domain-ui-logic';
import { Banner, BrandLockup, Button, Card, TextField } from '@careerpilot/ui-web';
import { Routes } from '@/core/routes';

export function SignInPage() {
  const t = useT();
  const form = useSignInForm();
  return (
    <>
      <BrandLockup />
      <h1 className="text-2xl font-bold">{t('auth.signIn')}</h1>
      {form.formError ? <Banner tone={StatusTone.Danger} icon={AlertCircle} title={t(form.formError)} /> : null}
      <Card className="gap-4">
        <form
          className="flex flex-col gap-4"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            form.submit();
          }}
        >
          <TextField label={t('auth.email')} type="email" autoComplete="email" value={form.values.email} onChange={(e) => form.setField('email', e.target.value)} error={form.errors.email} />
          <TextField label={t('auth.password')} secret autoComplete="current-password" value={form.values.password} onChange={(e) => form.setField('password', e.target.value)} error={form.errors.password} />
          <Button type="submit" fullWidth loading={form.submitting}>
            {t('auth.signIn')}
          </Button>
        </form>
        <Link href={Routes.forgotPassword} className="text-center text-sm font-medium text-primary">
          {t('auth.forgotPassword')}
        </Link>
      </Card>
      <p className="text-center text-sm">
        {t('auth.noAccount')}{' '}
        <Link href={Routes.register} className="font-semibold text-primary">
          {t('auth.createAccount')}
        </Link>
      </p>
    </>
  );
}
