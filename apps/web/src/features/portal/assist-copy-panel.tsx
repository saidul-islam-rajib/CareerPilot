'use client';

import { useState } from 'react';
import { assistCopyItems, usePortalActions, usePortalFillPlan, useT } from '@careerpilot/client-core';
import { Button, Card } from '@careerpilot/ui-web';

export function AssistCopyPanel({ applicationId }: { applicationId: string }) {
  const t = useT();
  const plan = usePortalFillPlan(applicationId);
  const actions = usePortalActions();
  const [copied, setCopied] = useState<string | null>(null);
  if (!plan.data) {
    return null;
  }
  const copy = async (id: string, value: string) => {
    await navigator.clipboard.writeText(value);
    setCopied(id);
  };
  const copyPassword = () => actions.revealPassword.mutate(applicationId, { onSuccess: (secret) => void copy('password', secret.password) });
  return (
    <Card>
      <p className="font-medium">{t('portal.assist.copyTitle')}</p>
      <p className="text-sm text-muted">{t('portal.assist.linkOnly')}</p>
      <a className="text-sm font-semibold text-primary underline-offset-2 hover:underline" href={plan.data.officialUrl} target="_blank" rel="noreferrer">
        {t('portal.assist.openOfficial')}
      </a>
      <div className="flex flex-wrap gap-2">
        {assistCopyItems(plan.data).map((item) => (
          <Button key={item.id} variant="outline" onClick={() => void copy(item.id, item.value)} data-testid={`assist-copy-${item.id}`}>
            {copied === item.id ? t('portal.assist.copied') : t('portal.assist.copy')}: {item.labelKey ? t(item.labelKey) : item.label}
          </Button>
        ))}
        {plan.data.hasPassword ? (
          <Button variant="outline" loading={actions.revealPassword.isPending} onClick={copyPassword} data-testid="assist-copy-password">
            {copied === 'password' ? t('portal.assist.copied') : t('portal.assist.copyPassword')}
          </Button>
        ) : null}
      </div>
    </Card>
  );
}
