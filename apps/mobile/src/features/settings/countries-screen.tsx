import { useExcludedCountries, useT } from '@careerpilot/client-core';
import { Card, EmptyState, ErrorState, LoadingState, Screen, TagInput, Text, TextTone } from '@/ui';

export function CountriesScreen() {
  const t = useT();
  const excluded = useExcludedCountries();
  const { settings } = excluded;
  if (settings.isPending) {
    return <LoadingState />;
  }
  if (settings.isError) {
    return <ErrorState onRetry={() => void settings.refetch()} />;
  }
  return (
    <Screen testID="countries-screen">
      <Text tone={TextTone.Muted}>{t('settings.countriesBody')}</Text>
      <Card>
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
    </Screen>
  );
}
