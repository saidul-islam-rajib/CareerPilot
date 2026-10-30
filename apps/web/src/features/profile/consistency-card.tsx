'use client';

import { TriangleAlert } from 'lucide-react';
import type { ConsistencyWarning } from '@careerpilot/api-client';
import { useT } from '@careerpilot/client-core';
import { ProfileBlock } from '@careerpilot/domain-ui-logic';
import { Card } from '@careerpilot/ui-web';
import { sectionAnchor } from './profile-support';

const BASICS_SECTION = 'profile';
const TITLE_ID = 'profile-consistency-title';

function anchorOf(warning: ConsistencyWarning): string {
  return sectionAnchor(warning.section === BASICS_SECTION ? ProfileBlock.About : warning.section);
}

export function ConsistencyCard({ warnings }: { warnings: ConsistencyWarning[] }) {
  const t = useT();
  if (warnings.length === 0) {
    return null;
  }
  return (
    <section aria-labelledby={TITLE_ID}>
      <Card className="gap-3 border-warning bg-warning-subtle">
        <div className="flex items-center gap-2">
          <TriangleAlert className="size-5 shrink-0 text-warning" aria-hidden />
          <h2 id={TITLE_ID} className="text-lg font-semibold text-foreground">
            {t('profile.consistency.title')}
          </h2>
        </div>
        <p className="text-sm text-muted">{t('profile.consistency.body')}</p>
        <ul className="flex flex-col gap-2">
          {warnings.map((warning) => (
            <li key={`${warning.kind}-${warning.entryId}-${warning.field}`} className="flex flex-wrap items-center justify-between gap-2 text-sm text-foreground">
              <span className="min-w-0 flex-1">{t(`profile.consistency.${warning.kind}`, { expected: warning.expected, found: warning.found })}</span>
              <a href={`#${anchorOf(warning)}`} className="font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus">
                {t('profile.consistency.fix')}
              </a>
            </li>
          ))}
        </ul>
      </Card>
    </section>
  );
}
