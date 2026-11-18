'use client';

import type { DashboardFilter } from '@careerpilot/api-client';
import { useT } from '@careerpilot/client-core';
import { Button, TextField } from '@careerpilot/ui-web';

const FILTER_FIELDS = ['dateFrom', 'dateTo', 'country', 'track', 'userId'] as const;
const DATE_FIELDS: ReadonlySet<string> = new Set(['dateFrom', 'dateTo']);

export function DashboardFilters({ filter, onChange }: { filter: DashboardFilter; onChange: (filter: DashboardFilter) => void }) {
  const t = useT();
  return (
    <form className="grid grid-cols-2 items-end gap-3 md:grid-cols-6" onSubmit={(event) => event.preventDefault()} aria-label={t('admin.dashboard.filters.title')}>
      {FILTER_FIELDS.map((field) => (
        <TextField
          key={field}
          label={t(`admin.dashboard.filters.${field}`)}
          type={DATE_FIELDS.has(field) ? 'date' : 'text'}
          value={filter[field] ?? ''}
          onChange={(event) => onChange({ ...filter, [field]: event.target.value })}
        />
      ))}
      <Button type="button" variant="outline" onClick={() => onChange({})}>
        {t('admin.dashboard.filters.clear')}
      </Button>
    </form>
  );
}
