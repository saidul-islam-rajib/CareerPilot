import { useState } from 'react';
import { portalUserStepKey, usePortalActions, usePortalAutopilot, useT } from '@careerpilot/client-core';
import { StatusTone } from '@careerpilot/domain-ui-logic';
import type { AutopilotState } from '@careerpilot/api-client';
import { Badge, Button, ButtonVariant, Card, Checkbox, ErrorState, LoadingState, Screen, SnackbarTone, SwitchRow, Text, TextField, TextTone, TextVariant, useSnackbar } from '@/ui';

function Summary({ state }: { state: AutopilotState }) {
  const t = useT();
  const { summary } = state;
  return (
    <Card>
      <Text variant={TextVariant.Subheading}>{t('portal.autopilot.summaryTitle')}</Text>
      <Text>
        {t('portal.autopilot.summaryRoutes')}: {summary.routes.join(', ')}
      </Text>
      <Text>
        {t('portal.autopilot.summaryRules')}: {summary.ruleNames.length ? summary.ruleNames.join(', ') : t('portal.autopilot.summaryNoRules')}
      </Text>
      <Text>
        {t('portal.autopilot.summaryDocuments')}: {summary.documentNames.length ? summary.documentNames.join(', ') : t('portal.autopilot.summaryNoDocuments')}
      </Text>
      <Text variant={TextVariant.Subheading}>{t('portal.autopilot.stillYours')}</Text>
      {summary.userOnlySteps.map((step) => (
        <Text key={step} tone={TextTone.Muted}>
          • {t(portalUserStepKey(step))}
        </Text>
      ))}
      <Text tone={TextTone.Muted}>{t('portal.autopilot.approvedHosts')}</Text>
      <Text tone={TextTone.Muted}>{summary.live ? t('portal.autopilot.liveOn') : t('portal.autopilot.liveOff')}</Text>
    </Card>
  );
}

function Setup({ state }: { state: AutopilotState }) {
  const t = useT();
  const snackbar = useSnackbar();
  const actions = usePortalActions();
  const current = state.settings.permissions;
  const [allowCreation, setAllowCreation] = useState(current.allowAccountCreation);
  const [email, setEmail] = useState(current.accountEmail ?? '');
  const [terms, setTerms] = useState(current.acceptTerms);
  const [privacy, setPrivacy] = useState(current.acceptPrivacy);
  const [verification, setVerification] = useState(current.allowEmailVerification);
  const [acknowledged, setAcknowledged] = useState(false);
  const failed = () => snackbar.show({ message: t('portal.autopilot.saveFailed'), tone: SnackbarTone.Danger });
  const enable = () =>
    actions.enable.mutate(
      { acknowledged, allowAccountCreation: allowCreation, accountEmail: email.trim() || undefined, acceptTerms: terms, acceptPrivacy: privacy, allowEmailVerification: verification },
      { onError: failed },
    );
  return (
    <Card>
      <SwitchRow label={t('portal.autopilot.allowAccountCreation')} value={allowCreation} onChange={setAllowCreation} />
      <TextField label={t('portal.autopilot.accountEmail')} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
      <Checkbox checked={terms} onChange={setTerms} accessibilityLabel={t('portal.autopilot.acceptTerms')}>
        <Text>{t('portal.autopilot.acceptTerms')}</Text>
      </Checkbox>
      <Checkbox checked={privacy} onChange={setPrivacy} accessibilityLabel={t('portal.autopilot.acceptPrivacy')}>
        <Text>{t('portal.autopilot.acceptPrivacy')}</Text>
      </Checkbox>
      <SwitchRow
        label={t('portal.autopilot.allowEmailVerification')}
        description={state.summary.mailConnected ? undefined : t('portal.autopilot.mailNotConnected')}
        value={verification}
        onChange={setVerification}
      />
      <Checkbox checked={acknowledged} onChange={setAcknowledged} accessibilityLabel={t('portal.autopilot.acknowledge')}>
        <Text>{t('portal.autopilot.acknowledge')}</Text>
      </Checkbox>
      <Button label={t('portal.autopilot.turnOn')} onPress={enable} disabled={!acknowledged} loading={actions.enable.isPending} fullWidth testID="autopilot-turn-on" />
      {state.settings.enabled ? (
        <Button label={t('portal.autopilot.turnOff')} variant={ButtonVariant.Outline} onPress={() => actions.disable.mutate(undefined, { onError: failed })} loading={actions.disable.isPending} fullWidth testID="autopilot-turn-off" />
      ) : null}
    </Card>
  );
}

export function AutopilotScreen() {
  const t = useT();
  const query = usePortalAutopilot();
  if (query.isPending) {
    return <LoadingState />;
  }
  if (query.isError) {
    return <ErrorState onRetry={() => void query.refetch()} />;
  }
  const enabled = query.data.settings.enabled;
  return (
    <Screen testID="autopilot-screen">
      <Badge label={enabled ? t('portal.menu.statusOn') : t('portal.menu.statusOff')} tone={enabled ? StatusTone.Success : StatusTone.Neutral} />
      <Text tone={TextTone.Muted}>{enabled ? t('portal.autopilot.on') : t('portal.autopilot.off')}</Text>
      <Text tone={TextTone.Muted}>{t('portal.autopilot.intro')}</Text>
      <Summary state={query.data} />
      <Setup state={query.data} />
    </Screen>
  );
}
