import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { IntegrationStatus } from '@careerpilot/api-client';
import { ConnectFailure, ConnectionStatus, type SyncFailure } from '@careerpilot/domain-ui-logic';
import { queryKeys } from '../query/query-keys';
import { useApi } from '../services/app-services';

const RETURN_CONNECTED = 'connected';
const RETURN_ERROR = 'error';
const CONNECT_FAILURES: readonly string[] = Object.values(ConnectFailure);

export const GOOGLE_RETURN_FLAG = 'google';
export const GOOGLE_RETURN_REASON = 'reason';

export type ConnectReturn = { kind: typeof RETURN_CONNECTED } | { kind: typeof RETURN_ERROR; reasonKey: string };

export function parseConnectReturn(flag: string | null | undefined, reason: string | null | undefined): ConnectReturn | undefined {
  if (flag === RETURN_CONNECTED) {
    return { kind: RETURN_CONNECTED };
  }
  if (flag !== RETURN_ERROR) {
    return undefined;
  }
  const known = CONNECT_FAILURES.includes(reason ?? '') ? reason : ConnectFailure.ExchangeFailed;
  return { kind: RETURN_ERROR, reasonKey: `integrations.reason.${known}` };
}

export function failureKey(failure: SyncFailure): string {
  return `integrations.failure.${failure}`;
}

export function connectionStatusKey(status: IntegrationStatus): string {
  if (!status.connection) {
    return 'integrations.status.notConnected';
  }
  return `integrations.status.${status.connection.status}`;
}

export function needsReconnect(status: IntegrationStatus): boolean {
  return status.connection?.status === ConnectionStatus.NeedsReconnect;
}

export function useGoogleStatus() {
  const api = useApi();
  return useQuery({ queryKey: queryKeys.googleStatus, queryFn: () => api.integrations.googleStatus() });
}

export function useRefreshGoogle(): () => Promise<void> {
  const client = useQueryClient();
  return () => client.invalidateQueries({ queryKey: queryKeys.googleStatus });
}

export function useAuthorizeGoogle() {
  const api = useApi();
  return useMutation({ mutationFn: () => api.integrations.googleAuthorizeUrl() });
}

export function useSyncGoogle() {
  const api = useApi();
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => api.integrations.syncGoogle(),
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: queryKeys.googleStatus }),
        client.invalidateQueries({ queryKey: queryKeys.applicationsAll }),
        client.invalidateQueries({ queryKey: queryKeys.notifications }),
        client.invalidateQueries({ queryKey: queryKeys.inbox }),
      ]);
    },
  });
}

export function useDisconnectGoogle() {
  const api = useApi();
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => api.integrations.disconnectGoogle(),
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.googleStatus }),
  });
}
