'use client';

import { Scale } from 'lucide-react';
import { usePublicConfig, useT } from '@careerpilot/client-core';
import { Card, ListRow, PageHeader, TeamSoberCredit } from '@careerpilot/ui-web';
import { teamSoberLogoSrc } from '@/core/brand-assets';

export function LicencesPage() {
  const t = useT();
  const { config } = usePublicConfig();
  return (
    <>
      <PageHeader title={t('settings.licences')} description={t('credits.licencesIntro')} />
      <Card className="max-w-xl">
        {config.openSourceComponents.map((component) => (
          <ListRow key={component.name} icon={Scale} title={component.name} subtitle={component.licence} href={component.url} />
        ))}
      </Card>
      <TeamSoberCredit logoSrc={teamSoberLogoSrc} />
    </>
  );
}
