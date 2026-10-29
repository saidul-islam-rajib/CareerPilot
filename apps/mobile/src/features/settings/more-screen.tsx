import { useRouter } from 'expo-router';
import { useDiscoverable, usePublicConfig, useSession, useSettings, useT } from '@careerpilot/client-core';
import { Bell, Clock, Globe, Info, MapPinOff, KeyRound, ListOrdered, LogOut, MessageSquareText, Palette, PauseCircle, ScrollText, ShieldCheck, Trash2 } from '@/ui/icons';
import { Routes } from '@/core/navigation/routes';
import { ServerLink } from '@/features/settings/server-screen';
import { Card, Divider, ListRow, Screen, TeamSoberCredit, Text, TextTone, TextVariant } from '@/ui';
import { SwitchRow } from '@/ui/switch-row';

function PrivacyCard() {
  const t = useT();
  const settings = useSettings();
  const discoverable = useDiscoverable();
  if (!settings.data) {
    return null;
  }
  return (
    <Card>
      <SwitchRow
        label={t('messaging.privacy')}
        description={t('messaging.privacyBody')}
        value={settings.data.discoverable}
        onChange={(value) => discoverable.mutate(value)}
        testID="discoverable-switch"
      />
    </Card>
  );
}

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
        <Divider />
        <ListRow icon={MessageSquareText} title={t('answers.title')} subtitle={t('answers.menuBody')} onPress={() => router.push(Routes.answers)} />
        <Divider />
        <ListRow icon={Globe} title={t('sources.title')} subtitle={t('sources.menuBody')} onPress={() => router.push(Routes.sources)} />
        <Divider />
        <ListRow icon={MapPinOff} title={t('settings.countries')} subtitle={t('settings.countriesMenuBody')} onPress={() => router.push(Routes.countries)} />
      </Card>
      <Card>
        <ListRow icon={Bell} title={t('settings.notifications')} subtitle={t('settings.digestBody')} onPress={() => router.push(Routes.notifications)} />
        <Divider />
        <ListRow icon={KeyRound} title={t('settings.changePassword')} onPress={() => router.push(Routes.changePassword)} />
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
      <PrivacyCard />
      <ServerLink />
      <Card>
        <ListRow icon={LogOut} title={t('auth.signOut')} onPress={() => void session.end()} />
        <Divider />
        <ListRow icon={Trash2} title={t('settings.deleteAccount')} destructive onPress={() => router.push(Routes.deleteAccount)} />
      </Card>
      <TeamSoberCredit />
    </Screen>
  );
}
