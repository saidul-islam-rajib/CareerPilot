'use client';

import { useState } from 'react';
import Link from 'next/link';
import { AlertCircle, MailCheck, Send } from 'lucide-react';
import { accountLinkErrorKey, usePublicConfig, useSchemas, useT } from '@careerpilot/client-core';
import { StatusTone } from '@careerpilot/domain-ui-logic';
import { validate, type FieldErrors } from '@careerpilot/validation';
import { Banner, Button, Card, TextField } from '@careerpilot/ui-web';
import { AdminRoutes } from '@/core/routes';
import { AuthLayout } from './auth-layout';
import { usePasswordLinkRequest } from './use-admin-links';

function BackToSignIn() {
  const t = useT();
  return (
    <Link href={AdminRoutes.signIn} className="text-center text-sm font-semibold text-primary hover:underline">
      {t('accountLinks.backToSignIn')}
    </Link>
  );
}

function LinkSent({ email }: { email: string }) {
  const t = useT();
  const { config } = usePublicConfig();
  return (
    <Card className="items-center gap-4 p-6 text-center">
      <span className="flex size-14 items-center justify-center rounded-full bg-primary-subtle text-primary">
        <MailCheck className="size-7" aria-hidden />
      </span>
      <h1 className="text-xl font-semibold text-foreground">{t('accountLinks.checkEmailTitle')}</h1>
      <p className="break-words text-muted">{t('adminLinks.sentBody', { email, minutes: config.accountLinks.ttlMinutes })}</p>
      <BackToSignIn />
    </Card>
  );
}

export function ForgotPasswordPage() {
  const t = useT();
  const schemas = useSchemas();
  const request = usePasswordLinkRequest();
  const [email, setEmail] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});

  const submit = () => {
    const result = validate(schemas.forgotPassword, { email });
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    request.mutate(result.value.email);
  };

  return (
    <AuthLayout>
      {request.isSuccess ? (
        <LinkSent email={request.variables} />
      ) : (
        <>
          <div className="flex flex-col gap-1">
            <h1 className="text-xl font-bold">{t('adminLinks.forgotTitle')}</h1>
            <p className="text-sm text-muted">{t('adminLinks.forgotBody')}</p>
          </div>
          {request.error ? <Banner tone={StatusTone.Danger} icon={AlertCircle} title={t(accountLinkErrorKey(request.error))} /> : null}
          <Card>
            <form
              className="flex flex-col gap-4"
              noValidate
              onSubmit={(e) => {
                e.preventDefault();
                submit();
              }}
            >
              <TextField label={t('auth.email')} type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} error={errors.email} />
              <Button type="submit" icon={Send} fullWidth loading={request.isPending}>
                {t('adminLinks.forgotSubmit')}
              </Button>
            </form>
          </Card>
          <BackToSignIn />
        </>
      )}
    </AuthLayout>
  );
}
