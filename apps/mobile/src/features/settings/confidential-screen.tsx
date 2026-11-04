import { useExcludedOrganizations, usePrivateNotifications, useT } from '@careerpilot/client-core';
import { Card, EmptyState, ErrorState, LoadingState, Screen, SwitchRow, TagInput, Text, TextTone } from '@/ui';

export function ConfidentialScreen() {
  const t = useT();
  const excluded = useExcludedOrganizations();
  const privacy = usePrivateNotifications();
  const { settings } = excluded;
  if (settings.isPending) {
    return <LoadingState />;
  }
  if (settings.isError) {
    return <ErrorState onRetry={() => void settings.refetch()} />;
  }
  return (
    <Screen testID="confidential-screen">
      <Text tone={TextTone.Muted}>{t('settings.excludedOrganizationsBody')}</Text>
      <Card>
        <TagInput
          label={t('settings.excludedOrganizationsLabel')}
          values={excluded.organizations}
          hint={t('settings.excludedOrganizationsHint')}
          error={excluded.failed ? t('settings.excludedOrganizationsInvalid') : undefined}
          addLabel={t('settings.excludedOrganizationsAdd')}
          removeLabel={(value) => t('settings.excludedOrganizationsRemove', { value })}
          onAdd={excluded.add}
          onRemove={excluded.remove}
        />
        {excluded.organizations.length === 0 ? <EmptyState body={t('settings.excludedOrganizationsEmpty')} /> : null}
      </Card>
      <Card>
        <SwitchRow
          label={t('settings.privateNotifications')}
          description={t('settings.privateNotificationsBody')}
          value={privacy.enabled}
          onChange={privacy.set}
          testID="private-notifications"
        />
      </Card>
    </Screen>
  );
}
