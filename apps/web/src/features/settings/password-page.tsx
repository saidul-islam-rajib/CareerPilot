'use client';

import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { useChangePasswordForm, usePublicConfig, useT } from '@careerpilot/client-core';
import { StatusTone } from '@careerpilot/domain-ui-logic';
import { Banner, Button, Card, PageHeader, TextField } from '@careerpilot/ui-web';

export function PasswordPage() {
  const t = useT();
  const form = useChangePasswordForm();
  const { config } = usePublicConfig();
  const passwordParams = { min: config.validationPolicy.password.minLength };
  return (
    <>
      <PageHeader title={t('settings.changePassword')} />
      {form.changed ? <Banner tone={StatusTone.Success} icon={CheckCircle2} title={t('settings.passwordChanged')} /> : null}
      {form.formError ? <Banner tone={StatusTone.Danger} icon={AlertCircle} title={t(form.formError)} /> : null}
      <Card className="max-w-xl gap-4">
        <form
          className="flex flex-col gap-4"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            form.submit();
          }}
        >
          <TextField
            label={t('settings.currentPassword')}
            secret
            autoComplete="current-password"
            value={form.values.currentPassword}
            onChange={(e) => form.setField('currentPassword', e.target.value)}
            error={form.errors.currentPassword}
          />
          <TextField
            label={t('settings.newPassword')}
            secret
            autoComplete="new-password"
            value={form.values.newPassword}
            onChange={(e) => form.setField('newPassword', e.target.value)}
            error={form.errors.newPassword}
            errorParams={passwordParams}
            hint={t('validation.passwordLength', passwordParams)}
          />
          <TextField
            label={t('settings.confirmNewPassword')}
            secret
            autoComplete="new-password"
            value={form.values.confirmPassword}
            onChange={(e) => form.setField('confirmPassword', e.target.value)}
            error={form.errors.confirmPassword}
          />
          <Button type="submit" loading={form.submitting}>
            {t('settings.changePassword')}
          </Button>
        </form>
      </Card>
    </>
  );
}
