'use client';

import { useState } from 'react';
import { AlertTriangle, CalendarX } from 'lucide-react';
import { useAccountDeletion, useFormat, usePublicConfig, useT } from '@careerpilot/client-core';
import { StatusTone } from '@careerpilot/domain-ui-logic';
import { Banner, Button, Card, PageHeader, TextField } from '@careerpilot/ui-web';

export function DeleteAccountPage() {
  const t = useT();
  const format = useFormat();
  const { config } = usePublicConfig();
  const deletion = useAccountDeletion();
  const [typed, setTyped] = useState('');
  return (
    <>
      <PageHeader title={t('settings.deleteAccount')} />
      <Banner tone={StatusTone.Danger} icon={AlertTriangle} title={t('settings.deleteAccount')} body={t('settings.deleteAccountBody', { days: config.accountDeletionGraceDays })} />
      {deletion.isSuccess ? (
        <Banner tone={StatusTone.Info} icon={CalendarX} title={t('settings.deletionScheduled', { date: format.date(deletion.data.scheduledFor) })} />
      ) : (
        <Card className="max-w-xl gap-4">
          <TextField label={t('settings.deleteAccountConfirm')} value={typed} onChange={(e) => setTyped(e.target.value)} autoCapitalize="characters" />
          <Button variant="destructive" disabled={typed.trim() !== t('settings.deleteKeyword')} onClick={() => deletion.mutate()} loading={deletion.isPending}>
            {t('settings.deleteAccount')}
          </Button>
        </Card>
      )}
    </>
  );
}
