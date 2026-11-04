'use client';

import { Info } from 'lucide-react';
import { useFormat, useT } from '@careerpilot/client-core';
import type { AcademicWarning, AttentionItem } from '@careerpilot/api-client';
import { Badge, Banner } from '@careerpilot/ui-web';
import { StatusTone } from '@careerpilot/domain-ui-logic';

export type EnumName = string;

export function useEnumOptions() {
  const t = useT();
  return (name: EnumName, values: readonly string[]) =>
    values.map((value) => ({
      value,
      label: t(`academic.enums.${name}.${value}`),
    }));
}

export function useEnumLabel() {
  const t = useT();
  return (name: EnumName, value: string) => t(`academic.enums.${name}.${value}`);
}

export function Notices() {
  const t = useT();
  return (
    <div className="flex flex-col gap-2">
      <Banner tone={StatusTone.Info} icon={Info} title={t('academic.neverSends')} />
      <p className="text-sm text-muted">{t('academic.notAdvice')}</p>
    </div>
  );
}

export function WarningLine({ warning }: { warning: AcademicWarning }) {
  const t = useT();
  const format = useFormat();
  return (
    <p className="text-sm text-warning">
      {t(`academic.warnings.${warning.kind}`, {
        date: warning.on ? format.date(warning.on) : '',
      })}
    </p>
  );
}

export function AttentionBadge({ item }: { item: AttentionItem }) {
  const t = useT();
  return <Badge label={t(`academic.attention.${item.kind}`)} tone={StatusTone.Warning} />;
}

export function dateOrDash(value: string | undefined, format: { date: (value: string) => string }): string {
  return value ? format.date(value) : '-';
}
