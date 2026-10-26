'use client';

import { MailCheck } from 'lucide-react';
import { usePasswordReset, useT } from '@careerpilot/client-core';
import { StatusTone } from '@careerpilot/domain-ui-logic';
import { Banner, BrandLockup, Button, Card, TextField } from '@careerpilot/ui-web';

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
          <Button type="submit" fullWidth loading={form.submitting}>
            {t('auth.sendResetLink')}
          </Button>
        </form>
      </Card>
    </>
  );
}
