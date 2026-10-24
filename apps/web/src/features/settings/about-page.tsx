'use client';

import { ExternalLink } from 'lucide-react';
import { usePublicConfig, useT } from '@careerpilot/client-core';
import { BrandLockup, Card, ListRow, PageHeader, Separator, TeamSoberCredit } from '@careerpilot/ui-web';
import { teamSoberLogoSrc } from '@/core/brand-assets';
import { getAppVersion } from '@/core/web-config';

export function AboutPage() {
  const t = useT();
  const { config } = usePublicConfig();
  return (
    <>
      <PageHeader title={t('settings.about')} />
      <Card className="max-w-xl items-center gap-3 py-8 text-center">
        <BrandLockup />
        <p className="text-muted">{t('app.tagline')}</p>
        <p className="text-sm text-muted">{t('settings.version', { version: getAppVersion() })}</p>
      </Card>
      <Card className="max-w-xl">
        <TeamSoberCredit logoSrc={teamSoberLogoSrc} />
        <Separator />
        <ListRow icon={ExternalLink} title={t('auth.terms')} href={config.legal.termsUrl} />
        <ListRow icon={ExternalLink} title={t('auth.privacy')} href={config.legal.privacyUrl} />
      </Card>
    </>
  );
}
