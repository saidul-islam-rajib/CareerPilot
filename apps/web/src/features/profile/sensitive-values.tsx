'use client';

import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import type { ProfileEntry } from '@careerpilot/api-client';
import { useRevealField, useT } from '@careerpilot/client-core';
import type { SectionDefinition } from '@careerpilot/dynamic-forms';
import { Button } from '@careerpilot/ui-web';
import { useProfileFeedback } from './profile-support';

function SensitiveValue({ section, entry, field }: { section: string; entry: ProfileEntry; field: string }) {
  const t = useT();
  const feedback = useProfileFeedback();
  const reveal = useRevealField(section);
  const [shown, setShown] = useState<string | null>(null);
  const label = t(`profile.fields.${section}.${field}`);
  const show = () => reveal.mutate({ id: entry.id, field }, { onSuccess: setShown, onError: (error) => feedback.failed(error) });
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="text-muted">{label}</span>
      <span className="font-mono text-foreground">{shown ?? String(entry.values[field])}</span>
      {shown === null ? (
        <Button variant="ghost" size="sm" icon={Eye} loading={reveal.isPending} onClick={show} aria-label={t('profile.sensitive.reveal', { field: label })}>
          {t('profile.sensitive.showAction')}
        </Button>
      ) : (
        <Button variant="ghost" size="sm" icon={EyeOff} onClick={() => setShown(null)} aria-label={t('profile.sensitive.hide', { field: label })}>
          {t('profile.sensitive.hideAction')}
        </Button>
      )}
    </div>
  );
}

export function SensitiveValues({ section, entry }: { section: SectionDefinition; entry: ProfileEntry }) {
  const fields = section.fields.filter((f) => f.sensitive && entry.values[f.key]);
  return (
    <>
      {fields.map((f) => (
        <SensitiveValue key={f.key} section={section.key} entry={entry} field={f.key} />
      ))}
    </>
  );
}
