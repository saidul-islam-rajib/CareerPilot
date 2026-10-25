'use client';

import type { ReactNode } from 'react';
import { CheckCircle2, Circle } from 'lucide-react';
import type { Profile } from '@careerpilot/api-client';
import { useProfile, useProfileSettings, useT } from '@careerpilot/client-core';
import { ProfileBlock, isEnumValue } from '@careerpilot/domain-ui-logic';
import type { SectionDefinition } from '@careerpilot/dynamic-forms';
import { Card, ErrorState, ImageViewer, LoadingState, cn } from '@careerpilot/ui-web';
import { ContactsSection } from './contacts-section';
import { DocumentsSection } from './documents-section';
import { EntrySection } from './entry-section';
import { AboutSection, ProfileHeader } from './profile-header';
import { sectionAnchor } from './profile-support';
import { SkillsSection } from './skills-section';

interface PageBlock {
  key: string;
  title: string;
  filled: boolean;
  render: () => ReactNode;
}

function useBlocks(profile: Profile): PageBlock[] {
  const t = useT();
  const { settings } = useProfileSettings();
  const fixed: Record<ProfileBlock, Omit<PageBlock, 'key'>> = {
    [ProfileBlock.About]: { title: t('profile.about'), filled: Boolean(profile.summary), render: () => <AboutSection profile={profile} /> },
    [ProfileBlock.Contacts]: { title: t('profile.contacts'), filled: profile.contacts.length > 0, render: () => <ContactsSection contacts={profile.contacts} /> },
    [ProfileBlock.Skills]: { title: t('profile.skills'), filled: profile.skills.length > 0, render: () => <SkillsSection skills={profile.skills} /> },
    [ProfileBlock.Documents]: { title: t('profile.documents'), filled: profile.documents.length > 0, render: () => <DocumentsSection documents={profile.documents} /> },
  };
  const sectionBlock = (section: SectionDefinition): PageBlock => ({
    key: section.key,
    title: t(`profile.sections.${section.key}.title`),
    filled: (profile.sections[section.key]?.length ?? 0) > 0,
    render: () => <EntrySection section={section} entries={profile.sections[section.key]} />,
  });
  const ordered = settings.pageOrder.flatMap((key): PageBlock[] => {
    if (isEnumValue(ProfileBlock, key)) {
      return [{ key, ...fixed[key] }];
    }
    const section = settings.sections.find((s) => s.key === key);
    return section ? [sectionBlock(section)] : [];
  });
  const remaining = settings.sections.filter((section) => !settings.pageOrder.includes(section.key)).map(sectionBlock);
  return [...ordered, ...remaining];
}

function SectionIndex({ blocks }: { blocks: PageBlock[] }) {
  const t = useT();
  return (
    <nav aria-label={t('profile.sectionIndex')} className="min-w-0 lg:sticky lg:top-6 lg:self-start">
      <ul className="relative -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 lg:mx-0 lg:flex-col lg:gap-1 lg:overflow-visible lg:px-0">
        {blocks.map((block) => {
          const Glyph = block.filled ? CheckCircle2 : Circle;
          return (
            <li key={block.key} className="shrink-0">
              <a
                href={`#${sectionAnchor(block.key)}`}
                className={cn(
                  'flex min-h-11 items-center gap-2 whitespace-nowrap rounded-pill border border-border bg-card px-3 text-sm text-foreground hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus',
                  'lg:rounded-control lg:border-transparent lg:bg-transparent',
                )}
              >
                <Glyph className={cn('size-4 shrink-0', block.filled ? 'text-success' : 'text-muted')} aria-hidden />
                <span>{block.title}</span>
                {block.filled ? <span className="sr-only">{t('profile.sectionDone')}</span> : null}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function ProfilePage() {
  const t = useT();
  const profile = useProfile();

  if (profile.isPending) {
    return <LoadingState />;
  }
  if (profile.isError) {
    return <ErrorState onRetry={() => void profile.refetch()} />;
  }
  return <ProfileContent profile={profile.data} signatureLabel={t('profile.signature')} zoomLabel={t('profile.tapToZoom')} />;
}

function ProfileContent({ profile, signatureLabel, zoomLabel }: { profile: Profile; signatureLabel: string; zoomLabel: string }) {
  const blocks = useBlocks(profile);
  return (
    <div className="flex flex-col gap-6">
      <ProfileHeader profile={profile} />
      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[14rem_minmax(0,1fr)]">
        <SectionIndex blocks={blocks} />
        <div className="flex min-w-0 flex-col gap-6">
          {blocks.map((block) => (
            <div key={block.key}>{block.render()}</div>
          ))}
          {profile.signatureUrl ? (
            <Card>
              <h2 className="font-semibold">{signatureLabel}</h2>
              <ImageViewer
                src={profile.signatureUrl}
                title={signatureLabel}
                trigger={
                  <button type="button" aria-label={`${signatureLabel}. ${zoomLabel}`} className="w-full max-w-sm rounded-control bg-surface p-2">
                    <img src={profile.signatureUrl} alt="" className="w-full" />
                  </button>
                }
              />
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}
