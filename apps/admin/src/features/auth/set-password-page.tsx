'use client';

import { Suspense, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { AlertCircle, KeyRound, ShieldAlert } from 'lucide-react';
import type { AdminLinkDetails } from '@careerpilot/api-client';
import { accountLinkErrorKey, useT } from '@careerpilot/client-core';
import { StatusTone } from '@careerpilot/domain-ui-logic';
import { Banner, Button, Card, LoadingState, TextField, buttonVariants } from '@careerpilot/ui-web';
import { AdminRoutes } from '@/core/routes';
import { AuthLayout } from './auth-layout';
import { useAdminLink, useAdminPasswordForm } from './use-admin-links';

const TOKEN_PARAMETER = 'token';

function LinkProblem({ messageKey }: { messageKey: string }) {
  const t = useT();
  return (
    <Card className="items-center gap-4 p-6 text-center">
      <span className="flex size-14 items-center justify-center rounded-full bg-warning-subtle text-warning">
        <ShieldAlert className="size-7" aria-hidden />
      </span>
      <h1 className="text-xl font-semibold text-foreground">{t('accountLinks.invalidTitle')}</h1>
      <p className="text-muted">{t(messageKey)}</p>
      <Link href={AdminRoutes.forgotPassword} className={buttonVariants({ fullWidth: true })}>
        {t('accountLinks.requestNew')}
      </Link>
      <Link href={AdminRoutes.signIn} className="text-sm font-semibold text-primary hover:underline">
        {t('accountLinks.backToSignIn')}
      </Link>
    </Card>
  );
}

function PasswordForm({ token, details }: { token: string; details: AdminLinkDetails }) {
  const t = useT();
  const router = useRouter();
  const form = useAdminPasswordForm(token);
  const passwordParams = { min: form.policy.password.minLength };

  useEffect(() => {
    if (form.done) {
      router.replace(AdminRoutes.dashboard);
    }
  }, [form.done, router]);

  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-bold">{t('adminLinks.setPasswordTitle')}</h1>
        <p className="text-muted">{t('adminLinks.setPasswordBody', { name: details.fullName })}</p>
        <p className="break-all text-sm font-medium text-foreground">{details.email}</p>
      </div>
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
          <input type="email" name="username" autoComplete="username" value={details.email} readOnly hidden />
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
          <Button type="submit" icon={KeyRound} fullWidth loading={form.submitting || form.done}>
            {t('adminLinks.setPasswordSubmit')}
          </Button>
        </form>
      </Card>
    </>
  );
}

function SetPasswordContent() {
  const t = useT();
  const token = useSearchParams().get(TOKEN_PARAMETER)?.trim() ?? '';
  const link = useAdminLink(token);
  if (!token) {
    return <LinkProblem messageKey="accountLinks.linkMissing" />;
  }
  if (link.isPending) {
    return <LoadingState label={t('accountLinks.checking')} />;
  }
  if (link.isError) {
    return <LinkProblem messageKey={accountLinkErrorKey(link.error)} />;
  }
  return <PasswordForm token={token} details={link.data} />;
}

export function SetPasswordPage() {
  return (
    <AuthLayout>
      <Suspense fallback={<LoadingState />}>
        <SetPasswordContent />
      </Suspense>
    </AuthLayout>
  );
}
