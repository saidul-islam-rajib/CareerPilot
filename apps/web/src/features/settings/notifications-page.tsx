'use client';

import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { useNotificationsForm, useT } from '@careerpilot/client-core';
import { StatusTone } from '@careerpilot/domain-ui-logic';
import { Banner, Button, Card, Checkbox, ErrorState, LoadingState, PageHeader, TextField } from '@careerpilot/ui-web';

export function NotificationsPage() {
  const t = useT();
  const form = useNotificationsForm();
  const { settings } = form;
  return (
    <>
      <PageHeader title={t('settings.notifications')} description={t('settings.digestBody')} />
      {settings.isPending ? <LoadingState /> : null}
      {settings.isError ? <ErrorState onRetry={() => void settings.refetch()} /> : null}
      {form.saved ? <Banner tone={StatusTone.Success} icon={CheckCircle2} title={t('common.saved')} /> : null}
      {form.formError ? <Banner tone={StatusTone.Danger} icon={AlertCircle} title={t(form.formError)} /> : null}
      {settings.isSuccess ? (
        <Card className="max-w-xl gap-4">
          <form
            className="flex flex-col gap-4"
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              form.submit();
            }}
          >
            <Checkbox checked={form.values.digestEnabled} onChange={form.setDigestEnabled}>
              {t('settings.digestEnabled')}
            </Checkbox>
            <TextField
              label={t('settings.digestTime')}
              value={form.values.digestTime}
              onChange={(e) => form.setDigestTime(e.target.value)}
              error={form.errors.digestTime}
              placeholder={t('settings.timePlaceholder')}
              inputMode="numeric"
              disabled={!form.values.digestEnabled}
            />
            <Button type="submit" loading={form.saving}>
              {t('common.save')}
            </Button>
          </form>
        </Card>
      ) : null}
    </>
  );
}
