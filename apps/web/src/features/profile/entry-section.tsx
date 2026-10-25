'use client';

import { useState } from 'react';
import { ArrowDown, ArrowUp, ExternalLink, Pencil, Plus, Trash2 } from 'lucide-react';
import type { ProfileEntry } from '@careerpilot/api-client';
import { sortEntries, useFormat, useProfileSettings, useRemoveEntry, useReorderEntries, useRestoreEntry, useT } from '@careerpilot/client-core';
import { describeEntry, type SectionDefinition } from '@careerpilot/dynamic-forms';
import { Button, Card, OverflowMenu, SortableList } from '@careerpilot/ui-web';
import { EntryDialog } from './entry-dialog';
import { sectionAnchor, sectionIcon, useProfileFeedback } from './profile-support';

interface DialogState {
  open: boolean;
  entry?: ProfileEntry;
  version: number;
}

function EntryCard({
  section,
  entry,
  index,
  count,
  onEdit,
  onRemove,
  onMove,
}: {
  section: SectionDefinition;
  entry: ProfileEntry;
  index: number;
  count: number;
  onEdit: () => void;
  onRemove: () => void;
  onMove: (from: number, to: number) => void;
}) {
  const t = useT();
  const format = useFormat();
  const { optionLabel } = useProfileSettings();
  const display = describeEntry(section, entry.values, optionLabel);
  const meta = [...display.subtitle, display.period ? format.period(display.period) : undefined].filter(Boolean).join(' · ');
  return (
    <div className="flex items-start gap-2 py-2">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <button type="button" onClick={onEdit} className="w-fit text-left font-semibold text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus">
          {display.title}
        </button>
        {meta ? <p className="text-sm text-muted">{meta}</p> : null}
        {display.body ? <p className="line-clamp-3 whitespace-pre-line text-sm text-foreground">{display.body}</p> : null}
        {display.link ? (
          <a href={display.link} target="_blank" rel="noopener noreferrer" className="flex w-fit max-w-full items-center gap-1 text-sm text-primary underline-offset-4 hover:underline">
            <ExternalLink className="size-4 shrink-0" aria-hidden />
            <span className="truncate">{display.link}</span>
          </a>
        ) : null}
      </div>
      <OverflowMenu
        label={t('common.moreActions', { item: display.title })}
        items={[
          { label: t('common.edit'), icon: Pencil, onSelect: onEdit },
          { label: t('common.moveUp'), icon: ArrowUp, onSelect: () => onMove(index, index - 1), disabled: index === 0 },
          { label: t('common.moveDown'), icon: ArrowDown, onSelect: () => onMove(index, index + 1), disabled: index === count - 1 },
          { label: t('common.remove'), icon: Trash2, onSelect: onRemove, destructive: true },
        ]}
      />
    </div>
  );
}

export function EntrySection({ section, entries }: { section: SectionDefinition; entries: ProfileEntry[] | undefined }) {
  const t = useT();
  const feedback = useProfileFeedback();
  const { optionLabel } = useProfileSettings();
  const reorder = useReorderEntries(section.key);
  const remove = useRemoveEntry(section.key);
  const restore = useRestoreEntry(section.key);
  const [dialog, setDialog] = useState<DialogState>({ open: false, version: 0 });
  const sorted = sortEntries(entries);
  const Glyph = sectionIcon(section.icon);
  const titleId = `${sectionAnchor(section.key)}-title`;

  const open = (entry?: ProfileEntry) => setDialog((current) => ({ open: true, entry, version: current.version + 1 }));
  const removeEntry = (entry: ProfileEntry) => {
    const title = describeEntry(section, entry.values, optionLabel).title;
    remove.mutate(entry.id, {
      onSuccess: () => feedback.removed(title, () => restore.mutate(entry.id, { onError: (error) => feedback.failed(error) })),
      onError: (error) => feedback.failed(error),
    });
  };

  return (
    <section id={sectionAnchor(section.key)} aria-labelledby={titleId} className="scroll-mt-24">
      <Card className="gap-3">
        <div className="flex items-center gap-3">
          <Glyph className="size-5 shrink-0 text-primary" aria-hidden />
          <h2 id={titleId} className="min-w-0 flex-1 text-lg font-semibold text-foreground">
            {t(`profile.sections.${section.key}.title`)}
          </h2>
          <Button variant="secondary" size="sm" icon={Plus} onClick={() => open()}>
            {t('common.add')}
          </Button>
        </div>
        {sorted.length === 0 ? (
          <button
            type="button"
            onClick={() => open()}
            className="rounded-control border border-dashed border-input px-4 py-5 text-left text-sm text-muted hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
          >
            {t(`profile.sections.${section.key}.empty`)}
          </button>
        ) : (
          <div className="divide-y divide-border">
            <SortableList
              items={sorted}
              keyOf={(entry) => entry.id}
              labelOf={(entry) => describeEntry(section, entry.values, optionLabel).title}
              onReorder={reorder.move}
              moveButtons={false}
              renderItem={(entry) => (
                <EntryCard
                  section={section}
                  entry={entry}
                  index={sorted.indexOf(entry)}
                  count={sorted.length}
                  onEdit={() => open(entry)}
                  onRemove={() => removeEntry(entry)}
                  onMove={reorder.move}
                />
              )}
            />
          </div>
        )}
      </Card>
      {dialog.open ? (
        <EntryDialog key={dialog.version} section={section} entry={dialog.entry} open={dialog.open} onOpenChange={(value) => setDialog((current) => ({ ...current, open: value }))} />
      ) : null}
    </section>
  );
}
