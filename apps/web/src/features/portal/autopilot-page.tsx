'use client';

import { useState } from 'react';
import { StatusTone } from '@careerpilot/domain-ui-logic';
import type { AutopilotState } from '@careerpilot/api-client';
import { portalUserStepKey, usePortalActions, usePortalAutopilot, useT } from '@careerpilot/client-core';
import { Badge, Button, Card, Checkbox, ErrorState, LoadingState, PageHeader, Section, SwitchField, TextField, useToast } from '@careerpilot/ui-web';

function Summary({ state }: { state: AutopilotState }) {
  const t = useT();
  const { summary } = state;
  return (
    <Card className="gap-3">
      <h2 className="text-lg font-semibold">{t('portal.autopilot.summaryTitle')}</h2>
      <p>{t('portal.autopilot.summaryRoutes')}: {summary.routes.join(', ')}</p>
      <p>
        {t('portal.autopilot.summaryRules')}: {summary.ruleNames.length ? summary.ruleNames.join(', ') : t('portal.autopilot.summaryNoRules')}
      </p>
      <p>
        {t('portal.autopilot.summaryDocuments')}: {summary.documentNames.length ? summary.documentNames.join(', ') : t('portal.autopilot.summaryNoDocuments')}
      </p>
      <p className="font-medium">{t('portal.autopilot.stillYours')}</p>
      <ul className="list-disc pl-5">
        {summary.userOnlySteps.map((step) => (
          <li key={step}>{t(portalUserStepKey(step))}</li>
        ))}
      </ul>
      <p className="text-sm text-muted">{t('portal.autopilot.approvedHosts')}</p>
      <p className="text-sm text-muted">{summary.live ? t('portal.autopilot.liveOn') : t('portal.autopilot.liveOff')}</p>
    </Card>
  );
}

function Setup({ state }: { state: AutopilotState }) {
  const t = useT();
  const toast = useToast();
  const actions = usePortalActions();
  const current = state.settings.permissions;
  const [allowCreation, setAllowCreation] = useState(current.allowAccountCreation);
  const [email, setEmail] = useState(current.accountEmail ?? '');
  const [terms, setTerms] = useState(current.acceptTerms);
  const [privacy, setPrivacy] = useState(current.acceptPrivacy);
  const [verification, setVerification] = useState(current.allowEmailVerification);
  const [acknowledged, setAcknowledged] = useState(false);
  const failed = () => toast.show({ message: t('portal.autopilot.saveFailed') });
  const enable = () =>
    actions.enable.mutate(
      {
        acknowledged,
        allowAccountCreation: allowCreation,
        accountEmail: email.trim() || undefined,
        acceptTerms: terms,
        acceptPrivacy: privacy,
        allowEmailVerification: verification,
      },
      { onError: failed },
    );
  return (
    <Card className="gap-4">
      <SwitchField checked={allowCreation} onChange={setAllowCreation} label={t('portal.autopilot.allowAccountCreation')} />
      <TextField label={t('portal.autopilot.accountEmail')} type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
      <Checkbox checked={terms} onChange={setTerms}>
        {t('portal.autopilot.acceptTerms')}
      </Checkbox>
      <Checkbox checked={privacy} onChange={setPrivacy}>
        {t('portal.autopilot.acceptPrivacy')}
      </Checkbox>
      <SwitchField
        checked={verification}
        onChange={setVerification}
        label={t('portal.autopilot.allowEmailVerification')}
        description={state.summary.mailConnected ? undefined : t('portal.autopilot.mailNotConnected')}
      />
      <Checkbox checked={acknowledged} onChange={setAcknowledged}>
        {t('portal.autopilot.acknowledge')}
      </Checkbox>
      <div className="flex flex-wrap gap-2">
        <Button onClick={enable} disabled={!acknowledged} loading={actions.enable.isPending}>
          {t('portal.autopilot.turnOn')}
        </Button>
        {state.settings.enabled ? (
          <Button variant="outline" onClick={() => actions.disable.mutate(undefined, { onError: failed })} loading={actions.disable.isPending}>
            {t('portal.autopilot.turnOff')}
          </Button>
        ) : null}
      </div>
    </Card>
  );
}

export function AutopilotPage() {
  const t = useT();
  const query = usePortalAutopilot();
  if (query.isPending) {
    return <LoadingState />;
  }
  if (query.isError) {
    return <ErrorState onRetry={() => query.refetch()} />;
  }
  const state = query.data;
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t('portal.autopilot.title')} description={state.settings.enabled ? t('portal.autopilot.on') : t('portal.autopilot.off')} />
      <div>
        <Badge tone={state.settings.enabled ? StatusTone.Success : StatusTone.Neutral} label={state.settings.enabled ? t('portal.menu.statusOn') : t('portal.menu.statusOff')} />
      </div>
      <Section title={t('portal.autopilot.intro')}>
        <Summary state={state} />
        <Setup state={state} />
      </Section>
    </div>
  );
}
