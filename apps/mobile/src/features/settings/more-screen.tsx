import { useRouter } from 'expo-router';
import { usePublicConfig, useSession, useT } from '@careerpilot/client-core';
import { Clock, Info, ListOrdered, LogOut, Palette, PauseCircle, ScrollText, ShieldCheck, Trash2 } from 'lucide-react-native';
import { Routes } from '@/core/navigation/routes';
import { Card, Divider, ListRow, Screen, TeamSoberCredit, Text, TextTone, TextVariant } from '@/ui';

export function MoreScreen() {
  const t = useT();
  const router = useRouter();
  const session = useSession();
  const { config } = usePublicConfig();
  return (
    <Screen testID="more-screen">
      {session.user ? (
        <Text variant={TextVariant.Label} tone={TextTone.Muted}>
          {t('common.signedInAs', { email: session.user.email })}
        </Text>
      ) : null}
      <Card>
        <ListRow icon={ListOrdered} title={t('settings.tracks')} subtitle={t('settings.tracksBody')} onPress={() => router.push(Routes.tracks)} />
        <Divider />
        <ListRow icon={PauseCircle} title={t('settings.pause')} subtitle={t('settings.pauseBody')} onPress={() => router.push(Routes.pause)} />
        <Divider />
        <ListRow icon={Clock} title={t('settings.submissionWindow')} subtitle={t('settings.submissionWindowBody')} onPress={() => router.push(Routes.submissionWindow)} />
      </Card>
      <Card>
        <ListRow icon={Palette} title={t('settings.appearance')} subtitle={t('settings.activeTheme', { theme: t(`themes.${config.theme}`) })} />
        <Text variant={TextVariant.Caption} tone={TextTone.Muted}>
          {t('settings.themeManaged')}
        </Text>
      </Card>
      <Card>
        <ListRow icon={ShieldCheck} title={t('settings.signInActivity')} onPress={() => router.push(Routes.activity)} />
        <Divider />
        <ListRow icon={Info} title={t('settings.about')} onPress={() => router.push(Routes.about)} />
        <Divider />
        <ListRow icon={ScrollText} title={t('settings.licences')} onPress={() => router.push(Routes.licences)} />
      </Card>
      <Card>
        <ListRow icon={LogOut} title={t('auth.signOut')} onPress={() => void session.end()} />
        <Divider />
        <ListRow icon={Trash2} title={t('settings.deleteAccount')} destructive onPress={() => router.push(Routes.deleteAccount)} />
      </Card>
      <TeamSoberCredit />
    </Screen>
  );
}
