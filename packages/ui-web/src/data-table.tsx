import type { ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useT } from '@careerpilot/client-core';
import { Button } from './button';
import { cn } from './cn';

export interface Column<T> {
  key: string;
  header: string;
  cell: (row: T) => ReactNode;
  className?: string;
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  caption: string;
  onRowClick?: (row: T) => void;
  empty?: ReactNode;
}

export function DataTable<T>({ columns, rows, rowKey, caption, onRowClick, empty }: DataTableProps<T>) {
  return (
    <div className="overflow-x-auto rounded-card border border-border bg-card">
      <table className="w-full min-w-[40rem] border-collapse text-left text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead className="bg-surface text-xs font-semibold uppercase text-muted">
          <tr>
            {columns.map((column) => (
              <th key={column.key} scope="col" className={cn('px-4 py-3', column.className)}>
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length}>{empty}</td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr
                key={rowKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={cn('border-t border-border', onRowClick && 'cursor-pointer hover:bg-surface')}
              >
                {columns.map((column) => (
                  <td key={column.key} className={cn('px-4 py-3 align-middle', column.className)}>
                    {column.cell(row)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

export interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}

export function Pagination({ page, pageSize, total, onPageChange }: PaginationProps) {
  const t = useT();
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <nav aria-label={t('admin.pageOf', { page, pages, total })} className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-muted">{t('admin.pageOf', { page, pages, total })}</p>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" icon={ChevronLeft} disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
          {t('admin.previous')}
        </Button>
        <Button variant="outline" size="sm" icon={ChevronRight} disabled={page >= pages} onClick={() => onPageChange(page + 1)}>
          {t('admin.next')}
        </Button>
      </div>
    </nav>
  );
}
