'use client';

import { useConsents, useFormat, useT, useUpdateConsent } from '@careerpilot/client-core';
import { StatusTone } from '@careerpilot/domain-ui-logic';
import { Badge, Card, ErrorState, LoadingState, PageHeader, SwitchField } from '@careerpilot/ui-web';

export function ConsentsPage() {
  const t = useT();
  const format = useFormat();
  const consents = useConsents();
  const update = useUpdateConsent();
  return (
    <>
      <PageHeader title={t('privacy.consent.title')} description={t('privacy.consent.intro')} />
      {consents.isLoading ? <LoadingState /> : null}
      {consents.isError ? <ErrorState onRetry={() => void consents.refetch()} /> : null}
      {consents.data ? (
        <>
          <Card className="gap-2">
            {consents.data.current.map((entry) =>
              entry.required ? (
                <div key={entry.kind} className="flex items-center justify-between gap-3 px-2 py-3">
                  <span className="flex flex-col">
                    <span className="font-semibold">{t(`privacy.consent.kind.${entry.kind}`)}</span>
                    <span className="text-sm text-muted">{t(`privacy.consent.kindBody.${entry.kind}`)}</span>
                  </span>
                  <Badge label={t('privacy.consent.required')} tone={StatusTone.Neutral} />
                </div>
              ) : (
                <SwitchField
                  key={entry.kind}
                  className="px-2 py-3"
                  label={t(`privacy.consent.kind.${entry.kind}`)}
                  description={t(`privacy.consent.kindBody.${entry.kind}`)}
                  checked={entry.granted}
                  onChange={(granted) => update.mutate({ kind: entry.kind, granted })}
                />
              ),
            )}
          </Card>
          <h2 className="text-lg font-semibold">{t('privacy.consent.history')}</h2>
          <Card className="gap-2">
            {consents.data.history.map((record) => (
              <p key={record.id} className="text-sm">
                <span className="font-semibold">{t(`privacy.consent.kind.${record.kind}`)}</span>{' '}
                {t('privacy.consent.historyLine', {
                  state: record.granted ? t('privacy.consent.stateGranted') : t('privacy.consent.stateWithdrawn'),
                  date: format.dateTime(record.at),
                  version: record.version,
                })}
              </p>
            ))}
          </Card>
        </>
      ) : null}
    </>
  );
}
