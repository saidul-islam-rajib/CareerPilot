'use client';

import { useState, type ReactNode } from 'react';
import { Search } from 'lucide-react';
import type { Page, PageQuery } from '@careerpilot/api-client';
import { useEnumDisplay, useT } from '@careerpilot/client-core';
import type { EnumKey } from '@careerpilot/domain-ui-logic';
import { DataTable, EmptyState, ErrorState, LoadingState, PageHeader, Pagination, type Column } from '@careerpilot/ui-web';
import { usePagedList } from '@/core/admin-queries';
import { useAdminServices } from '@/core/admin-services';

export interface ListPageProps<T> {
  title: string;
  description?: string;
  resource: string;
  fetcher: (query: PageQuery) => Promise<Page<T>>;
  columns: Column<T>[];
  rowKey: (row: T) => string;
  statusEnum?: { key: EnumKey; values: string[] };
  onRowClick?: (row: T) => void;
  aside?: ReactNode;
}

export function ListPage<T>({ title, description, resource, fetcher, columns, rowKey, statusEnum, onRowClick, aside }: ListPageProps<T>) {
  const t = useT();
  const display = useEnumDisplay();
  const { config } = useAdminServices();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const query: PageQuery = { search: search || undefined, status: status || undefined, page, pageSize: config.admin.pageSize };
  const list = usePagedList(resource, query, fetcher);

  return (
    <>
      <PageHeader title={title} description={description} actions={aside} />
      <div className="flex flex-wrap gap-3">
        <label className="relative flex min-w-64 flex-1 items-center">
          <span className="sr-only">{t('admin.search')}</span>
          <Search className="pointer-events-none absolute left-3 size-4 text-muted" aria-hidden />
          <input
            type="search"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder={t('admin.search')}
            className="min-h-11 w-full rounded-control border border-input bg-background pl-9 pr-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
          />
        </label>
        {statusEnum ? (
          <label className="flex items-center gap-2 text-sm">
            <span className="text-muted">{t('admin.filterStatus')}</span>
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
              className="min-h-11 rounded-control border border-input bg-background px-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
            >
              <option value="">{t('admin.allStatuses')}</option>
              {statusEnum.values.map((value) => (
                <option key={value} value={value}>
                  {display(statusEnum.key, value).label}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>
      {list.isPending ? <LoadingState /> : null}
      {list.isError ? <ErrorState onRetry={() => void list.refetch()} /> : null}
      {list.data ? (
        <>
          <DataTable columns={columns} rows={list.data.items} rowKey={rowKey} caption={title} onRowClick={onRowClick} empty={<EmptyState />} />
          <Pagination page={list.data.page} pageSize={list.data.pageSize} total={list.data.total} onPageChange={setPage} />
        </>
      ) : null}
    </>
  );
}
