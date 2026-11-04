'use client';

import { useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, CalendarX } from 'lucide-react';
import { useCancelDeletion, useDeletion, useFormat, useRequestDeletion, useT } from '@careerpilot/client-core';
import { StatusTone } from '@careerpilot/domain-ui-logic';
import { Banner, Button, Card, ErrorState, LoadingState, PageHeader, TextField } from '@careerpilot/ui-web';
import { Routes } from '@/core/routes';

export function DeleteAccountPage() {
  const t = useT();
  const format = useFormat();
  const deletion = useDeletion();
  const request = useRequestDeletion();
  const cancel = useCancelDeletion();
  const [typed, setTyped] = useState('');
  const [password, setPassword] = useState('');
  const view = deletion.data;
  if (deletion.isLoading) {
    return <LoadingState />;
  }
  if (!view) {
    return <ErrorState onRetry={() => void deletion.refetch()} />;
  }
  if (view.scheduledFor) {
    return (
      <>
        <PageHeader title={t('settings.deleteAccount')} />
        <Banner tone={StatusTone.Warning} icon={CalendarX} title={t('privacy.deletion.pendingTitle', { date: format.date(view.scheduledFor) })} body={t('privacy.deletion.pendingBody')} />
        <Button variant="secondary" loading={cancel.isPending} onClick={() => cancel.mutate()} className="max-w-xs">
          {t('privacy.deletion.cancel')}
        </Button>
      </>
    );
  }
  return (
    <>
      <PageHeader title={t('settings.deleteAccount')} />
      <Banner tone={StatusTone.Danger} icon={AlertTriangle} title={t('settings.deleteAccount')} body={t('settings.deleteAccountBody', { days: view.plan.graceDays })} />
      <Card className="gap-2">
        <h2 className="text-lg font-semibold">{t('privacy.deletion.erasedTitle')}</h2>
        <ul className="list-disc pl-5">
          {view.plan.erased.map((scope) => (
            <li key={scope}>{t(`privacy.deletion.scope.${scope}`)}</li>
          ))}
        </ul>
        <h2 className="text-lg font-semibold">{t('privacy.deletion.keptTitle')}</h2>
        <ul className="list-disc pl-5">
          {view.plan.retained.map((item) => (
            <li key={item.record}>{t('privacy.deletion.keptLine', { record: item.record, days: item.retentionDays, reason: item.reason })}</li>
          ))}
        </ul>
        <h2 className="text-lg font-semibold">{t('privacy.deletion.externalTitle')}</h2>
        <ul className="list-disc pl-5">
          {view.plan.external.map((item) => (
            <li key={item}>{t(`privacy.deletion.external.${item}`)}</li>
          ))}
        </ul>
        <Link className="text-primary underline" href={Routes.exports}>
          {t('privacy.deletion.exportFirst')}
        </Link>
      </Card>
      <Card className="max-w-xl gap-4">
        <TextField label={t('privacy.deletion.passwordLabel')} type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        <TextField label={t('settings.deleteAccountConfirm')} value={typed} onChange={(e) => setTyped(e.target.value)} autoCapitalize="characters" />
        {request.isError ? <Banner tone={StatusTone.Danger} icon={AlertTriangle} title={t('privacy.deletion.wrongPassword')} /> : null}
        <Button
          variant="destructive"
          disabled={typed.trim() !== t('settings.deleteKeyword') || password.length === 0}
          onClick={() => request.mutate(password)}
          loading={request.isPending}
        >
          {t('settings.deleteAccount')}
        </Button>
      </Card>
    </>
  );
}
