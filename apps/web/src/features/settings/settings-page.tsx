'use client';

import { Bell, Clock, Info, KeyRound, ListOrdered, LogOut, MessageSquareText, Palette, PauseCircle, ScrollText, ShieldCheck, Trash2 } from 'lucide-react';
import { usePublicConfig, useSession, useT } from '@careerpilot/client-core';
import { Card, ListRow, PageHeader, Separator, TeamSoberCredit } from '@careerpilot/ui-web';
import { teamSoberLogoSrc } from '@/core/brand-assets';
import { Routes } from '@/core/routes';

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
        </Card>
        <Card>
          <ListRow icon={Bell} title={t('settings.notifications')} subtitle={t('settings.digestBody')} href={Routes.notifications} />
          <Separator />
          <ListRow icon={KeyRound} title={t('settings.changePassword')} href={Routes.changePassword} />
        </Card>
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
