import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ExportInput, ExportView } from '@careerpilot/api-client';
import { ExportStatus, type ConsentKind, type ReportPeriod } from '@careerpilot/domain-ui-logic';
import { queryKeys } from '../query/query-keys';
import { useApi } from '../services/app-services';

const EXPORT_POLL_MS = 2000;
const OPEN_STATUSES: readonly string[] = [ExportStatus.Queued, ExportStatus.Running];

export function hasOpenExport(exports: ExportView[] | undefined): boolean {
  return Boolean(exports?.some((item) => OPEN_STATUSES.includes(item.status)));
}

export function useReport(period: ReportPeriod, date?: string) {
  const api = useApi();
  return useQuery({ queryKey: queryKeys.report(period, date), queryFn: () => api.privacy.report(period, date) });
}

export function useExports() {
  const api = useApi();
  return useQuery({
    queryKey: queryKeys.exports,
    queryFn: () => api.privacy.listExports(),
    refetchInterval: (query) => (hasOpenExport(query.state.data) ? EXPORT_POLL_MS : false),
  });
}

export function useRequestExport() {
  const api = useApi();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: ExportInput) => api.privacy.requestExport(input),
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.exports }),
  });
}

export function useDeletion() {
  const api = useApi();
  return useQuery({ queryKey: queryKeys.deletion, queryFn: () => api.privacy.deletion() });
}

export function useRequestDeletion() {
  const api = useApi();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (password: string) => api.privacy.requestDeletion(password),
    onSuccess: (view) => {
      client.setQueryData(queryKeys.deletion, view);
      return client.invalidateQueries({ queryKey: queryKeys.googleStatus });
    },
  });
}

export function useCancelDeletion() {
  const api = useApi();
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => api.privacy.cancelDeletion(),
    onSuccess: (view) => client.setQueryData(queryKeys.deletion, view),
  });
}

export function useConsents() {
  const api = useApi();
  return useQuery({ queryKey: queryKeys.consents, queryFn: () => api.privacy.consents() });
}

export function useUpdateConsent() {
  const api = useApi();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (change: { kind: ConsentKind; granted: boolean }) => api.privacy.updateConsent(change.kind, change.granted),
    onSuccess: (overview) => client.setQueryData(queryKeys.consents, overview),
  });
}

const DAY_MS = 86_400_000;
const WEEK_DAYS = 7;
const ISO_DATE_LENGTH = 10;

export function shiftReportDate(date: string, period: ReportPeriod, direction: 1 | -1): string {
  const days = period === 'weekly' ? WEEK_DAYS : 1;
  return new Date(new Date(`${date}T00:00:00.000Z`).getTime() + direction * days * DAY_MS).toISOString().slice(0, ISO_DATE_LENGTH);
}

export function exportKb(sizeBytes: number | undefined): number {
  return Math.max(1, Math.round((sizeBytes ?? 0) / 1024));
}
