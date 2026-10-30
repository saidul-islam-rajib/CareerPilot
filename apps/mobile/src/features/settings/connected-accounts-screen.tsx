import { useState } from 'react';
import { View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import type { IntegrationStatus } from '@careerpilot/api-client';
import {
  connectionStatusKey,
  failureKey,
  needsReconnect,
  useAuthorizeGoogle,
  useDisconnectGoogle,
  useFormat,
  useGoogleStatus,
  useRefreshGoogle,
  useSyncGoogle,
  useT,
} from '@careerpilot/client-core';
import { ConnectionStatus, StatusTone } from '@careerpilot/domain-ui-logic';
import { useTheme } from '@/core/theme/theme';
import { AlertTriangle, CalendarCheck, Mail, Plug, RefreshCw, Unplug } from '@/ui/icons';
import { Badge, Banner, Button, ButtonVariant, Card, ErrorState, Icon, LoadingState, Screen, SnackbarTone, Text, TextTone, TextVariant, useSnackbar } from '@/ui';

function AccessRow({ icon, label, allowed }: { icon: typeof Mail; label: string; allowed: boolean }) {
  const t = useT();
  const theme = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space.md }}>
      <Icon icon={icon} color={theme.colors.textMuted} />
      <Text style={{ flex: 1 }}>{label}</Text>
      <Badge label={allowed ? t('integrations.page.accessOn') : t('integrations.page.accessOff')} tone={allowed ? StatusTone.Success : StatusTone.Neutral} />
    </View>
  );
}

function GoogleCard({ status }: { status: IntegrationStatus }) {
  const t = useT();
  const format = useFormat();
  const theme = useTheme();
  const snackbar = useSnackbar();
  const authorize = useAuthorizeGoogle();
  const refresh = useRefreshGoogle();
  const sync = useSyncGoogle();
  const disconnect = useDisconnectGoogle();
  const [confirming, setConfirming] = useState(false);
  const connection = status.connection;
  const reconnect = needsReconnect(status);
  const failed = () => snackbar.show({ message: t('integrations.page.actionFailed'), tone: SnackbarTone.Danger });
  const connect = () =>
    authorize.mutate(undefined, {
      onSuccess: ({ url }) => void WebBrowser.openBrowserAsync(url).then(refresh),
      onError: () => snackbar.show({ message: t('integrations.page.connectFailed'), tone: SnackbarTone.Danger }),
    });
  const checkNow = () =>
    sync.mutate(undefined, {
      onSuccess: (summary) => snackbar.show({ message: t('integrations.page.syncDone', { messages: summary.messages, events: summary.events }) }),
      onError: failed,
    });
  return (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: theme.space.md }}>
        <Text variant={TextVariant.Heading}>{t('integrations.page.googleName')}</Text>
        <Badge label={t(connectionStatusKey(status))} tone={status.connected ? StatusTone.Success : reconnect ? StatusTone.Warning : StatusTone.Neutral} />
      </View>
      {connection ? (
        <View style={{ gap: theme.space.xs }}>
          <Text variant={TextVariant.Subheading}>{t('integrations.page.connectedAs', { email: connection.email })}</Text>
          <Text variant={TextVariant.Label} tone={TextTone.Muted}>
            {connection.lastSyncAt ? t('integrations.page.lastSync', { time: format.dateTime(connection.lastSyncAt) }) : t('integrations.page.neverSynced')}
          </Text>
        </View>
      ) : null}
      {connection?.lastError ? <Banner tone={StatusTone.Warning} icon={AlertTriangle} title={t(failureKey(connection.lastError))} /> : null}
      {status.configured ? null : <Banner tone={StatusTone.Info} icon={AlertTriangle} title={t('integrations.page.notConfigured')} />}
      <AccessRow icon={Mail} label={t('integrations.page.mailAccess')} allowed={status.mailAccess} />
      <AccessRow icon={CalendarCheck} label={t('integrations.page.calendarAccess')} allowed={status.calendarAccess} />
      <Text variant={TextVariant.Label} tone={TextTone.Muted}>
        {t('integrations.page.readOnlyNote')}
      </Text>
      {connection?.status === ConnectionStatus.Connected ? (
        confirming ? (
          <View style={{ gap: theme.space.sm }}>
            <Text variant={TextVariant.Subheading}>{t('integrations.page.disconnectTitle')}</Text>
            <Text tone={TextTone.Muted}>{t('integrations.page.disconnectBody')}</Text>
            <Button
              label={t('integrations.page.disconnectConfirm')}
              variant={ButtonVariant.Destructive}
              onPress={() => disconnect.mutate(undefined, { onSuccess: () => setConfirming(false), onError: failed })}
              loading={disconnect.isPending}
              fullWidth
              testID="google-disconnect-confirm"
            />
            <Button label={t('integrations.page.disconnectKeep')} variant={ButtonVariant.Secondary} onPress={() => setConfirming(false)} fullWidth />
          </View>
        ) : (
          <View style={{ gap: theme.space.sm }}>
            <Button label={sync.isPending ? t('integrations.page.syncing') : t('integrations.page.syncNow')} icon={RefreshCw} onPress={checkNow} loading={sync.isPending} fullWidth testID="google-sync" />
            <Button label={t('integrations.page.disconnect')} icon={Unplug} variant={ButtonVariant.Secondary} onPress={() => setConfirming(true)} fullWidth testID="google-disconnect" />
          </View>
        )
      ) : (
        <View style={{ gap: theme.space.sm }}>
          <Button
            label={reconnect ? t('integrations.page.reconnect') : t('integrations.page.connect')}
            icon={Plug}
            onPress={connect}
            loading={authorize.isPending}
            disabled={!status.configured}
            fullWidth
            testID="google-connect"
          />
          <Text variant={TextVariant.Label} tone={TextTone.Muted}>
            {t('integrations.page.localHint')}
          </Text>
        </View>
      )}
    </Card>
  );
}

export function ConnectedAccountsScreen() {
  const t = useT();
  const status = useGoogleStatus();
  if (status.isPending) {
    return <LoadingState />;
  }
  if (status.isError) {
    return <ErrorState onRetry={() => void status.refetch()} />;
  }
  return (
    <Screen testID="connected-accounts-screen">
      <Text tone={TextTone.Muted}>{t('integrations.page.intro')}</Text>
      <GoogleCard status={status.data} />
    </Screen>
  );
}
