import { useState } from 'react';
import { useRouter } from 'expo-router';
import { useServerAddress, useT } from '@careerpilot/client-core';
import { StatusTone } from '@careerpilot/domain-ui-logic';
import { AlertCircle, Server } from '@/ui/icons';
import { Routes } from '@/core/navigation/routes';
import { Banner, Button, ButtonVariant, Card, Screen, Text, TextField, TextTone, useSnackbar } from '@/ui';

export function ServerScreen() {
  const t = useT();
  const router = useRouter();
  const snackbar = useSnackbar();
  const server = useServerAddress();
  const [typed, setTyped] = useState(server.label);
  const save = async () => {
    if (await server.change(typed)) {
      snackbar.show({ message: t('server.saved', { address: typed.trim() }) });
      router.back();
    }
  };
  return (
    <Screen
      testID="server-screen"
      footer={<Button label={t('server.save')} icon={Server} onPress={() => void save()} loading={server.checking} fullWidth testID="server-save" />}
    >
      <Text tone={TextTone.Muted}>{t('server.body')}</Text>
      {server.problemKey ? <Banner tone={StatusTone.Danger} icon={AlertCircle} title={t(server.problemKey)} /> : null}
      <Card>
        <TextField
          label={t('server.field')}
          value={typed}
          onChangeText={setTyped}
          hint={t('server.hint')}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          onSubmitEditing={() => void save()}
          testID="server-address"
        />
      </Card>
    </Screen>
  );
}

export function ServerLink() {
  const t = useT();
  const router = useRouter();
  const server = useServerAddress();
  if (!server.allowed) {
    return null;
  }
  return (
    <Button
      label={`${t('server.current', { address: server.label })} · ${t('server.change')}`}
      variant={ButtonVariant.Ghost}
      onPress={() => router.push(Routes.server)}
      testID="server-link"
    />
  );
}
