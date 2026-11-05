'use client';

import { useState } from 'react';
import { accountNeedsAttention, accountStatusKey, useFormat, usePortalActions, usePortalAccounts, useT } from '@careerpilot/client-core';
import { Badge, Button, Card, ConfirmDialog, EmptyState, ErrorState, LoadingState, Section, TextField, useToast } from '@careerpilot/ui-web';
import { StatusTone, type PortalAccountStatus } from '@careerpilot/domain-ui-logic';

function AddForm() {
  const t = useT();
  const toast = useToast();
  const actions = usePortalActions();
  const [host, setHost] = useState('');
  const [employer, setEmployer] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const save = () =>
    actions.addAccount.mutate(
      { host, employer, email, password },
      {
        onSuccess: () => {
          setHost('');
          setEmployer('');
          setEmail('');
          setPassword('');
        },
        onError: () => toast.show({ message: t('portal.accounts.saveFailed') }),
      },
    );
  return (
    <Card className="gap-3">
      <h3 className="font-semibold">{t('portal.accounts.addTitle')}</h3>
      <div className="grid gap-3 md:grid-cols-2">
        <TextField label={t('portal.accounts.host')} value={host} onChange={(event) => setHost(event.target.value)} />
        <TextField label={t('portal.accounts.employerName')} value={employer} onChange={(event) => setEmployer(event.target.value)} />
        <TextField label={t('portal.accounts.emailField')} type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
        <TextField label={t('portal.accounts.passwordField')} type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
      </div>
      <div>
        <Button onClick={save} disabled={!host || !email || !password} loading={actions.addAccount.isPending}>
          {t('portal.accounts.save')}
        </Button>
      </div>
    </Card>
  );
}

function AccountRow({ id, host, employer, email, status, createdAt, siteUrl }: { id: string; host: string; employer: string; email: string; status: PortalAccountStatus; createdAt: string; siteUrl: string }) {
  const t = useT();
  const format = useFormat();
  const toast = useToast();
  const actions = usePortalActions();
  const [password, setPassword] = useState<string | undefined>();
  const failed = () => toast.show({ message: t('portal.accounts.loadFailed') });
  const toggle = () =>
    password === undefined
      ? actions.reveal.mutate(id, { onSuccess: (secret) => setPassword(secret.password), onError: failed })
      : setPassword(undefined);
  return (
    <Card className="gap-2">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold">{employer || host}</p>
          <p className="text-sm text-muted">
            {t('portal.accounts.portal')}: {host}
          </p>
          <p className="text-sm text-muted">
            {t('portal.accounts.email')}: {email}
          </p>
          <p className="text-sm text-muted">
            {t('portal.accounts.created')}: {format.date(createdAt)}
          </p>
        </div>
        <Badge tone={accountNeedsAttention(status) ? StatusTone.Warning : StatusTone.Success} label={t(accountStatusKey(status))} />
      </div>
      {password !== undefined ? (
        <p className="break-all font-mono text-sm">
          {t('portal.accounts.password')}: {password}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={toggle} loading={actions.reveal.isPending}>
          {password === undefined ? t('portal.accounts.view') : t('portal.accounts.hide')}
        </Button>
        {siteUrl ? (
          <a className="text-sm font-semibold text-primary underline-offset-2 hover:underline" href={siteUrl} target="_blank" rel="noreferrer">{t('portal.accounts.manage')}</a>
        ) : null}
        <ConfirmDialog
          title={t('portal.accounts.delete')}
          body={t('portal.accounts.deleteConfirm')}
          confirmLabel={t('portal.accounts.delete')}
          destructive
          onConfirm={() => actions.removeAccount.mutate(id)}
          trigger={
            <Button size="sm" variant="outline">
              {t('portal.accounts.delete')}
            </Button>
          }
        />
      </div>
    </Card>
  );
}

function ExportButton() {
  const t = useT();
  const toast = useToast();
  const actions = usePortalActions();
  const run = () =>
    actions.exportAll.mutate(undefined, {
      onSuccess: (items) => {
        const blob = new Blob([JSON.stringify(items, null, 2)], { type: 'application/json' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'portal-accounts.json';
        link.click();
        URL.revokeObjectURL(link.href);
      },
      onError: () => toast.show({ message: t('portal.accounts.exportFailed') }),
    });
  return (
    <Button variant="outline" onClick={run} loading={actions.exportAll.isPending}>
      {t('portal.accounts.export')}
    </Button>
  );
}

export function PortalAccountsSection() {
  const t = useT();
  const query = usePortalAccounts();
  return (
    <Section title={t('portal.accounts.title')}>
      <p className="text-muted">{t('portal.accounts.intro')}</p>
      {query.isPending ? <LoadingState /> : null}
      {query.isError ? <ErrorState onRetry={() => query.refetch()} /> : null}
      {query.data?.length === 0 ? <EmptyState title={t('portal.accounts.empty')} /> : null}
      {query.data?.map((account) => (
        <AccountRow key={account.id} {...account} />
      ))}
      {query.data?.length ? <ExportButton /> : null}
      <AddForm />
    </Section>
  );
}
