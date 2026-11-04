'use client';

import type { DeadlineNote } from '@careerpilot/api-client';
import { dayNoteKey, eligibilityKey, enumLabelKey, useFormat, useT } from '@careerpilot/client-core';
import { DayKind, Eligibility, StatusTone } from '@careerpilot/domain-ui-logic';
import { Badge } from '@careerpilot/ui-web';

const TONES: Record<Eligibility, StatusTone> = {
  [Eligibility.Met]: StatusTone.Success,
  [Eligibility.NotMet]: StatusTone.Danger,
  [Eligibility.Unknown]: StatusTone.Neutral,
};

export function EligibilityBadge({ outcome }: { outcome: Eligibility }) {
  const t = useT();
  return <Badge label={t(eligibilityKey(outcome))} tone={TONES[outcome]} />;
}

export function DayNote({ note }: { note?: DeadlineNote }) {
  const t = useT();
  const format = useFormat();
  if (!note) {
    return null;
  }
  const key = dayNoteKey(note.kind);
  const lines = [
    key ? t(key, { name: note.holidayName }) : undefined,
    note.outsideOfficeHours ? t('government.day.outsideHours') : undefined,
    note.kind !== DayKind.Working && note.previousWorkingDay ? t('government.day.previous', { date: format.date(note.previousWorkingDay) }) : undefined,
    note.kind !== DayKind.Working && note.nextWorkingDay ? t('government.day.next', { date: format.date(note.nextWorkingDay) }) : undefined,
  ].filter((line): line is string => Boolean(line));
  if (!lines.length) {
    return null;
  }
  return (
    <p className="text-sm text-warning" role="note">
      {lines.join(' ')} {t('government.day.notMoved')}
    </p>
  );
}

export { enumLabelKey };
