'use client';

import { EyeOff } from 'lucide-react';
import { useExcludedOrganizations, usePrivateNotifications, useT } from '@careerpilot/client-core';
import { Card, EmptyState, ErrorState, LoadingState, PageHeader, SwitchField, TagInput } from '@careerpilot/ui-web';

export function ConfidentialPage() {
  const t = useT();
  const excluded = useExcludedOrganizations();
  const privacy = usePrivateNotifications();
  const { settings } = excluded;
  return (
    <>
      <PageHeader title={t('settings.confidential')} description={t('settings.confidentialBody')} />
      {settings.isPending ? <LoadingState /> : null}
      {settings.isError ? <ErrorState onRetry={() => void settings.refetch()} /> : null}
      {settings.isSuccess ? (
        <div className="flex max-w-2xl flex-col gap-4">
          <Card className="gap-4">
            <div className="flex items-center gap-3">
              <EyeOff className="size-5 shrink-0 text-primary" aria-hidden />
              <h2 className="text-lg font-semibold">{t('settings.excludedOrganizations')}</h2>
            </div>
            <p className="text-sm text-muted">{t('settings.excludedOrganizationsBody')}</p>
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
            <SwitchField
              checked={privacy.enabled}
              onChange={privacy.set}
              label={t('settings.privateNotifications')}
              description={t('settings.privateNotificationsBody')}
            />
          </Card>
        </div>
      ) : null}
    </>
  );
}
