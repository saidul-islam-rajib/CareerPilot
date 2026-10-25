'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { AlertCircle, ShieldCheck } from 'lucide-react';
import { type SignInRequest } from '@careerpilot/api-client';
import { authErrorKey, useSchemas, useT } from '@careerpilot/client-core';
import { StatusTone } from '@careerpilot/domain-ui-logic';
import { validate, type FieldErrors } from '@careerpilot/validation';
import { Banner, BrandMark, Button, Card, TeamSoberCredit, TextField } from '@careerpilot/ui-web';
import { useAdminApi } from '@/core/admin-services';
import { useAdminSession } from '@/core/admin-session';
import { teamSoberLogoSrc } from '@/core/brand-assets';

export function SignInPage() {
  const t = useT();
  const api = useAdminApi();
  const session = useAdminSession();
  const schemas = useSchemas();
  const [values, setValues] = useState<SignInRequest>({ email: '', password: '' });
  const [errors, setErrors] = useState<FieldErrors>({});
  const signIn = useMutation({ mutationFn: (input: SignInRequest) => api.auth.signIn(input), onSuccess: (result) => session.start(result) });

  const submit = () => {
    const result = validate(schemas.signIn, values);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    signIn.mutate(result.value);
  };

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-6 px-4 py-10">
      <div className="flex items-center gap-3">
        <BrandMark className="size-12" />
        <span className="text-2xl font-bold">{t('admin.appName')}</span>
      </div>
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-bold">{t('admin.signInTitle')}</h1>
        <p className="flex items-center gap-2 text-sm text-muted">
          <ShieldCheck className="size-4" aria-hidden />
          {t('admin.signInBody')}
        </p>
      </div>
      {signIn.error ? (
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
          <Button type="submit" fullWidth loading={signIn.isPending}>
            {t('auth.signIn')}
          </Button>
        </form>
      </Card>
      <TeamSoberCredit logoSrc={teamSoberLogoSrc} compact />
    </main>
  );
}
