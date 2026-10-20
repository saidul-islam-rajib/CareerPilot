'use client';

import Link from 'next/link';
import { AlertCircle } from 'lucide-react';
import { usePublicConfig, useRegisterForm, useT } from '@careerpilot/client-core';
import { StatusTone } from '@careerpilot/domain-ui-logic';
import { Banner, BrandLockup, Button, Card, Checkbox, LinkedText, TextField } from '@careerpilot/ui-web';
import { Routes } from '@/core/routes';

export function RegisterPage() {
  const t = useT();
  const { config } = usePublicConfig();
  const form = useRegisterForm();
  const nameParams = { min: form.policy.name.minLength, max: form.policy.name.maxLength };
  const passwordParams = { min: form.policy.password.minLength };
  return (
    <>
      <BrandLockup />
      <h1 className="text-2xl font-bold">{t('auth.createAccount')}</h1>
      {form.formError ? <Banner tone={StatusTone.Danger} icon={AlertCircle} title={t(form.formError)} /> : null}
      <Card>
        <form
          className="flex flex-col gap-4"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            form.submit();
          }}
        >
          <TextField label={t('auth.fullName')} autoComplete="name" value={form.values.fullName} onChange={(e) => form.setField('fullName', e.target.value)} error={form.errors.fullName} errorParams={nameParams} />
          <TextField label={t('auth.email')} type="email" autoComplete="email" value={form.values.email} onChange={(e) => form.setField('email', e.target.value)} error={form.errors.email} />
          <TextField
            label={t('auth.password')}
            secret
            autoComplete="new-password"
            value={form.values.password}
            onChange={(e) => form.setField('password', e.target.value)}
            error={form.errors.password}
            errorParams={passwordParams}
            hint={t('validation.passwordLength', passwordParams)}
          />
          <TextField
            label={t('auth.confirmPassword')}
            secret
            autoComplete="new-password"
            value={form.values.confirmPassword}
            onChange={(e) => form.setField('confirmPassword', e.target.value)}
            error={form.errors.confirmPassword}
          />
          <Checkbox checked={form.values.consent} onChange={(v) => form.setField('consent', v)} error={form.errors.consent}>
            <LinkedText
              template={t('auth.consentLabel')}
              links={{ terms: { label: t('auth.terms'), href: config.legal.termsUrl }, privacy: { label: t('auth.privacy'), href: config.legal.privacyUrl } }}
            />
          </Checkbox>
          <p className="text-xs text-muted">{t('auth.consentNote')}</p>
          <Button type="submit" fullWidth loading={form.submitting}>
            {t('auth.createAccount')}
          </Button>
        </form>
      </Card>
      <p className="text-center text-sm">
        {t('auth.haveAccount')}{' '}
        <Link href={Routes.signIn} className="font-semibold text-primary">
          {t('auth.signIn')}
        </Link>
      </p>
    </>
  );
}
