import { useState } from 'react';
import { View } from 'react-native';
import { accountNeedsAttention, accountStatusKey, useFormat, usePortalAccounts, usePortalActions, useT } from '@careerpilot/client-core';
import { StatusTone } from '@careerpilot/domain-ui-logic';
import { Badge, Button, ButtonVariant, Card, EmptyState, ErrorState, LoadingState, Screen, SnackbarTone, Text, TextField, TextTone, TextVariant, useSnackbar } from '@/ui';

function AddForm() {
  const t = useT();
  const snackbar = useSnackbar();
  const actions = usePortalActions();
  const [host, setHost] = useState('');
  const [employer, setEmployer] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const save = () =>
    actions.addAccount.mutate(
      { host, employer, email, password },
      {
        onSuccess: () => {
          setHost('');
          setEmployer('');
          setEmail('');
          setPassword('');
        },
        onError: () => snackbar.show({ message: t('portal.accounts.saveFailed'), tone: SnackbarTone.Danger }),
      },
    );
  return (
    <Card>
      <Text variant={TextVariant.Subheading}>{t('portal.accounts.addTitle')}</Text>
      <TextField label={t('portal.accounts.host')} value={host} onChangeText={setHost} autoCapitalize="none" />
      <TextField label={t('portal.accounts.employerName')} value={employer} onChangeText={setEmployer} />
      <TextField label={t('portal.accounts.emailField')} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
      <TextField label={t('portal.accounts.passwordField')} value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" />
      <Button label={t('portal.accounts.save')} onPress={save} disabled={!host || !email || !password} loading={actions.addAccount.isPending} fullWidth testID="portal-account-save" />
    </Card>
  );
}

export function PortalAccountsScreen() {
  const t = useT();
  const format = useFormat();
  const snackbar = useSnackbar();
  const query = usePortalAccounts();
  const actions = usePortalActions();
  const [shown, setShown] = useState<Record<string, string>>({});
  const failed = (key: string) => snackbar.show({ message: t(key), tone: SnackbarTone.Danger });
  const hide = (id: string) => setShown((current) => Object.fromEntries(Object.entries(current).filter(([key]) => key !== id)));
  const toggle = (id: string) =>
    shown[id] !== undefined
      ? hide(id)
      : actions.reveal.mutate(id, {
          onSuccess: (secret) => setShown((current) => ({ ...current, [id]: secret.password })),
          onError: () => failed('portal.accounts.loadFailed'),
        });
  const exportAll = () =>
    actions.exportAll.mutate(undefined, {
      onSuccess: (items) => setShown(Object.fromEntries(items.map((item) => [item.id, item.password]))),
      onError: () => failed('portal.accounts.exportFailed'),
    });
  if (query.isPending) {
    return <LoadingState />;
  }
  if (query.isError) {
    return <ErrorState onRetry={() => void query.refetch()} />;
  }
  return (
    <Screen testID="portal-accounts-screen">
      <Text tone={TextTone.Muted}>{t('portal.accounts.intro')}</Text>
      {query.data.length === 0 ? <EmptyState title={t('portal.accounts.empty')} /> : null}
      {query.data.map((account) => (
        <Card key={account.id}>
          <Text variant={TextVariant.Subheading}>{account.employer || account.host}</Text>
          <Text tone={TextTone.Muted}>
            {t('portal.accounts.portal')}: {account.host}
          </Text>
          <Text tone={TextTone.Muted}>
            {t('portal.accounts.email')}: {account.email}
          </Text>
          <Text tone={TextTone.Muted}>
            {t('portal.accounts.created')}: {format.date(account.createdAt)}
          </Text>
          <Badge label={t(accountStatusKey(account.status))} tone={accountNeedsAttention(account.status) ? StatusTone.Warning : StatusTone.Success} />
          {shown[account.id] !== undefined ? (
            <Text>
              {t('portal.accounts.password')}: {shown[account.id]}
            </Text>
          ) : null}
          <View style={{ gap: 8 }}>
            <Button label={shown[account.id] === undefined ? t('portal.accounts.view') : t('portal.accounts.hide')} variant={ButtonVariant.Outline} onPress={() => toggle(account.id)} fullWidth />
            <Button label={t('portal.accounts.delete')} variant={ButtonVariant.Outline} onPress={() => actions.removeAccount.mutate(account.id)} fullWidth testID={`portal-account-delete-${account.id}`} />
          </View>
        </Card>
      ))}
      {query.data.length ? <Button label={t('portal.accounts.export')} variant={ButtonVariant.Outline} onPress={exportAll} loading={actions.exportAll.isPending} fullWidth testID="portal-accounts-export" /> : null}
      <AddForm />
    </Screen>
  );
}
