import { useState } from 'react';
import { AlertTriangle, CalendarX } from 'lucide-react-native';
import { StatusTone } from '@careerpilot/domain-ui-logic';
import { usePublicConfig } from '@/core/config/public-config';
import { useFormat } from '@/core/format/use-format';
import { useT } from '@/core/i18n/i18n';
import { Banner, Button, ButtonVariant, Card, Screen, TextField } from '@/ui';
import { useAccountDeletion } from './use-settings';

export function DeleteAccountScreen() {
  const t = useT();
  const format = useFormat();
  const { config } = usePublicConfig();
  const deletion = useAccountDeletion();
  const [typed, setTyped] = useState('');
  const keyword = t('settings.deleteKeyword');
  return (
    <Screen testID="delete-account-screen">
      <Banner tone={StatusTone.Danger} icon={AlertTriangle} title={t('settings.deleteAccount')} body={t('settings.deleteAccountBody', { days: config.accountDeletionGraceDays })} />
      {deletion.isSuccess ? (
        <Banner tone={StatusTone.Info} icon={CalendarX} title={t('settings.deletionScheduled', { date: format.date(deletion.data.scheduledFor) })} />
      ) : (
        <Card>
          <TextField label={t('settings.deleteAccountConfirm')} value={typed} onChangeText={setTyped} autoCapitalize="characters" testID="delete-confirm-input" />
          <Button
            label={t('settings.deleteAccount')}
            variant={ButtonVariant.Destructive}
            disabled={typed.trim() !== keyword}
            onPress={() => deletion.mutate()}
            loading={deletion.isPending}
            fullWidth
            testID="delete-confirm"
          />
        </Card>
      )}
    </Screen>
  );
}
