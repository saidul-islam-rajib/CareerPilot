'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useMutation } from '@tanstack/react-query';
import { AlertCircle, ShieldCheck } from 'lucide-react';
import { ApiErrorCode, isApiError, type AdminSignInRequest } from '@careerpilot/api-client';
import { authErrorKey, useSchemas, useT } from '@careerpilot/client-core';
import { StatusTone } from '@careerpilot/domain-ui-logic';
import { validate, type FieldErrors } from '@careerpilot/validation';
import { Banner, Button, Card, TextField } from '@careerpilot/ui-web';
import { useAdminApi } from '@/core/admin-services';
import { useAdminSession } from '@/core/admin-session';
import { AdminRoutes } from '@/core/routes';
import { AuthLayout } from './auth-layout';

export function SignInPage() {
  const t = useT();
  const api = useAdminApi();
  const session = useAdminSession();
  const schemas = useSchemas();
  const [values, setValues] = useState<AdminSignInRequest>({ email: '', password: '' });
  const [errors, setErrors] = useState<FieldErrors>({});
  const signIn = useMutation({ mutationFn: (input: AdminSignInRequest) => api.auth.signIn(input), onSuccess: (result) => session.start(result) });

  const codeNeeded = isApiError(signIn.error, ApiErrorCode.MfaRequired) || Boolean(values.code);

  const submit = () => {
    const result = validate(schemas.signIn, values);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    signIn.mutate({ ...result.value, code: values.code || undefined });
  };

  return (
    <AuthLayout>
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-bold">{t('admin.signInTitle')}</h1>
        <p className="flex items-center gap-2 text-sm text-muted">
          <ShieldCheck className="size-4" aria-hidden />
          {t('admin.signInBody')}
        </p>
      </div>
      {signIn.error && !isApiError(signIn.error, ApiErrorCode.MfaRequired) ? (
        <Banner tone={StatusTone.Danger} icon={AlertCircle} title={t(authErrorKey(signIn.error))} />
      ) : null}
      <Card>
        <form
          className="flex flex-col gap-4"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <TextField label={t('auth.email')} type="email" autoComplete="username" value={values.email} onChange={(e) => setValues((v) => ({ ...v, email: e.target.value }))} error={errors.email} />
          <TextField label={t('auth.password')} secret autoComplete="current-password" value={values.password} onChange={(e) => setValues((v) => ({ ...v, password: e.target.value }))} error={errors.password} />
          {codeNeeded ? (
            <TextField
              label={t('admin.mfa.codeLabel')}
              hint={t('admin.mfa.codeHint')}
              inputMode="numeric"
              autoComplete="one-time-code"
              value={values.code ?? ''}
              onChange={(e) => setValues((v) => ({ ...v, code: e.target.value }))}
            />
          ) : null}
          <Button type="submit" fullWidth loading={signIn.isPending}>
            {t('auth.signIn')}
          </Button>
          <Link href={AdminRoutes.forgotPassword} className="text-center text-sm font-semibold text-primary hover:underline">
            {t('auth.forgotPassword')}
          </Link>
        </form>
      </Card>
    </AuthLayout>
  );
}
