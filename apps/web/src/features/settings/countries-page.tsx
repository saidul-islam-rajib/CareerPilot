'use client';

import { Globe2 } from 'lucide-react';
import { useExcludedCountries, useT } from '@careerpilot/client-core';
import { Card, EmptyState, ErrorState, LoadingState, PageHeader, TagInput } from '@careerpilot/ui-web';

export function CountriesPage() {
  const t = useT();
  const excluded = useExcludedCountries();
  const { settings } = excluded;
  return (
    <>
      <PageHeader title={t('settings.countries')} description={t('settings.countriesBody')} />
      {settings.isPending ? <LoadingState /> : null}
      {settings.isError ? <ErrorState onRetry={() => void settings.refetch()} /> : null}
      {settings.isSuccess ? (
        <Card className="max-w-2xl gap-4">
          <div className="flex items-center gap-3">
            <Globe2 className="size-5 shrink-0 text-primary" aria-hidden />
            <h2 className="text-lg font-semibold">{t('settings.countries')}</h2>
          </div>
          <TagInput
            label={t('settings.countriesLabel')}
            values={excluded.countries}
            hint={t('settings.countriesHint')}
            error={excluded.failed ? t('settings.countriesInvalid') : undefined}
            addLabel={t('settings.countriesAdd')}
            removeLabel={(value) => t('settings.countriesRemove', { value })}
            onAdd={excluded.add}
            onRemove={excluded.remove}
          />
          {excluded.countries.length === 0 ? <EmptyState body={t('settings.countriesEmpty')} /> : null}
        </Card>
      ) : null}
    </>
  );
}
