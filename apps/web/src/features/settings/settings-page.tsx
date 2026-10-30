'use client';

import { Bell, Clock, MessageCircle, Globe, Plug, Globe2, Info, KeyRound, ListOrdered, LogOut, MessageSquareText, Palette, PauseCircle, ScrollText, ShieldCheck, Trash2 } from 'lucide-react';
import { useDiscoverable, usePublicConfig, useSession, useSettings, useT } from '@careerpilot/client-core';
import { Card, ListRow, PageHeader, Separator, SwitchField, TeamSoberCredit } from '@careerpilot/ui-web';
import { teamSoberLogoSrc } from '@/core/brand-assets';
import { Routes } from '@/core/routes';

function PrivacyCard() {
  const t = useT();
  const settings = useSettings();
  const discoverable = useDiscoverable();
  if (!settings.data) {
    return null;
  }
  return (
    <Card>
      <ListRow icon={MessageCircle} title={t('messaging.title')} subtitle={t('messaging.menuBody')} href={Routes.messages} />
      <Separator />
      <SwitchField
        className="px-2 py-3"
        label={t('messaging.privacy')}
        description={t('messaging.privacyBody')}
        checked={settings.data.discoverable}
        onChange={(value) => discoverable.mutate(value)}
      />
    </Card>
  );
}

export function SettingsPage() {
  const t = useT();
  const session = useSession();
  const { config } = usePublicConfig();
  return (
    <>
      <PageHeader title={t('settings.title')} description={session.user ? t('common.signedInAs', { email: session.user.email }) : undefined} />
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <ListRow icon={ListOrdered} title={t('settings.tracks')} subtitle={t('settings.tracksBody')} href={Routes.tracks} />
          <Separator />
          <ListRow icon={PauseCircle} title={t('settings.pause')} subtitle={t('settings.pauseBody')} href={Routes.pause} />
          <Separator />
          <ListRow icon={Clock} title={t('settings.submissionWindow')} subtitle={t('settings.submissionWindowBody')} href={Routes.submissionWindow} />
          <Separator />
          <ListRow icon={MessageSquareText} title={t('answers.title')} subtitle={t('answers.menuBody')} href={Routes.answers} />
          <Separator />
          <ListRow icon={Globe} title={t('sources.title')} subtitle={t('sources.menuBody')} href={Routes.sources} />
          <Separator />
          <ListRow icon={Plug} title={t('integrations.page.title')} subtitle={t('integrations.page.menuBody')} href={Routes.connectedAccounts} />
          <Separator />
          <ListRow icon={Globe2} title={t('settings.countries')} subtitle={t('settings.countriesMenuBody')} href={Routes.countries} />
        </Card>
        <Card>
          <ListRow icon={Bell} title={t('settings.notifications')} subtitle={t('settings.digestBody')} href={Routes.notifications} />
          <Separator />
          <ListRow icon={KeyRound} title={t('settings.changePassword')} href={Routes.changePassword} />
        </Card>
        <PrivacyCard />
        <Card>
          <ListRow icon={Palette} title={t('settings.appearance')} subtitle={t('settings.activeTheme', { theme: t(`themes.${config.theme}`) })} />
          <p className="text-xs text-muted">{t('settings.themeManaged')}</p>
        </Card>
        <Card>
          <ListRow icon={ShieldCheck} title={t('settings.signInActivity')} href={Routes.activity} />
          <Separator />
          <ListRow icon={Info} title={t('settings.about')} href={Routes.about} />
          <Separator />
          <ListRow icon={ScrollText} title={t('settings.licences')} href={Routes.licences} />
        </Card>
        <Card>
          <ListRow icon={LogOut} title={t('auth.signOut')} onClick={() => void session.end()} />
          <Separator />
          <ListRow icon={Trash2} title={t('settings.deleteAccount')} destructive href={Routes.deleteAccount} />
        </Card>
      </div>
      <TeamSoberCredit logoSrc={teamSoberLogoSrc} />
    </>
  );
}
