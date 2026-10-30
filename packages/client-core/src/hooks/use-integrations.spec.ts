import { describe, expect, it } from 'vitest';
import { catalogs, createTranslator } from '@careerpilot/i18n';
import type { ConnectedAccount } from '@careerpilot/api-client';
import { ConnectionStatus, IntegrationProvider, SyncFailure } from '@careerpilot/domain-ui-logic';
import { connectionStatusKey, failureKey, needsReconnect, parseConnectReturn } from './use-integrations';

const t = createTranslator(catalogs.en);

describe('connecting Google', () => {
  it('reads the flag Google sends the browser back with', () => {
    expect(parseConnectReturn('connected', null)).toEqual({ kind: 'connected' });
    expect(parseConnectReturn(undefined, undefined)).toBeUndefined();
    expect(parseConnectReturn('other', null)).toBeUndefined();
  });

  it('turns a failure reason into a catalog message, with a safe fallback', () => {
    const denied = parseConnectReturn('error', 'access_denied');
    expect(denied?.kind === 'error' && t(denied.reasonKey)).toBe("You didn't allow access.");
    const unknown = parseConnectReturn('error', 'something_new');
    expect(unknown?.kind === 'error' && unknown.reasonKey).toBe('integrations.reason.exchange_failed');
  });

  it('has a message for every sync failure and status', () => {
    for (const failure of Object.values(SyncFailure)) {
      expect(t(failureKey(failure))).not.toBe(failureKey(failure));
    }
    const base = { connected: false, configured: true, mailAccess: true, calendarAccess: true };
    expect(t(connectionStatusKey(base))).toBe('Not connected');
    const connection: Omit<ConnectedAccount, 'status'> = { provider: IntegrationProvider.Google, email: 'a@b.c', scopes: [], connectedAt: '2026-10-31T00:00:00.000Z' };
    expect(t(connectionStatusKey({ ...base, connection: { ...connection, status: ConnectionStatus.NeedsReconnect } }))).toBe('Needs reconnecting');
    expect(needsReconnect({ ...base, connection: { ...connection, status: ConnectionStatus.NeedsReconnect } })).toBe(true);
    expect(needsReconnect(base)).toBe(false);
  });
});
