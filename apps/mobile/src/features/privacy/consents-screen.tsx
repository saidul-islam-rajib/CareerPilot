import { useConsents, useFormat, useT, useUpdateConsent } from '@careerpilot/client-core';
import { StatusTone } from '@careerpilot/domain-ui-logic';
import { Badge, Card, ErrorState, LoadingState, Screen, SwitchRow, Text, TextTone, TextVariant } from '@/ui';

export function ConsentsScreen() {
  const t = useT();
  const format = useFormat();
  const consents = useConsents();
  const update = useUpdateConsent();
  return (
    <Screen testID="consents-screen">
      <Text tone={TextTone.Muted}>{t('privacy.consent.intro')}</Text>
      {consents.isLoading ? <LoadingState /> : null}
      {consents.isError ? <ErrorState onRetry={() => void consents.refetch()} /> : null}
      {consents.data ? (
        <>
          <Card>
            {consents.data.current.map((entry) =>
              entry.required ? (
                <Card key={entry.kind}>
                  <Text variant={TextVariant.Subheading}>{t(`privacy.consent.kind.${entry.kind}`)}</Text>
                  <Text tone={TextTone.Muted}>{t(`privacy.consent.kindBody.${entry.kind}`)}</Text>
                  <Badge label={t('privacy.consent.required')} tone={StatusTone.Neutral} />
                </Card>
              ) : (
                <SwitchRow
                  key={entry.kind}
                  label={t(`privacy.consent.kind.${entry.kind}`)}
                  description={t(`privacy.consent.kindBody.${entry.kind}`)}
                  value={entry.granted}
                  onChange={(granted) => update.mutate({ kind: entry.kind, granted })}
                  testID={`consent-${entry.kind}`}
                />
              ),
            )}
          </Card>
          <Text variant={TextVariant.Heading}>{t('privacy.consent.history')}</Text>
          <Card>
            {consents.data.history.map((record) => (
              <Text key={record.id}>
                {t(`privacy.consent.kind.${record.kind}`)}:{' '}
                {t('privacy.consent.historyLine', {
                  state: record.granted ? t('privacy.consent.stateGranted') : t('privacy.consent.stateWithdrawn'),
                  date: format.dateTime(record.at),
                  version: record.version,
                })}
              </Text>
            ))}
          </Card>
        </>
      ) : null}
    </Screen>
  );
}
