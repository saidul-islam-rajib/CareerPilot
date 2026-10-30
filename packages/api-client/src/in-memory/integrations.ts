import { ConnectionStatus, IntegrationProvider } from '@careerpilot/domain-ui-logic';
import type { Clock, IntegrationsApi } from '../ports';
import type { ConnectedAccount, IntegrationStatus } from '../types';

export const GOOGLE_MAIL_SCOPE = 'https://www.googleapis.com/auth/gmail.readonly';
export const GOOGLE_CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.events';
export const TEST_AUTHORIZE_URL = 'https://accounts.google.com/o/oauth2/v2/auth?state=test-state';

export interface InMemoryIntegrationOptions {
  clock: Clock;
  respond: <T>(value: T) => Promise<T>;
  connection?: ConnectedAccount;
}

export interface InMemoryIntegrations extends IntegrationsApi {
  simulateConnected(email: string, scopes?: string[]): void;
}

function statusOf(connection: ConnectedAccount | undefined): IntegrationStatus {
  return {
    connected: connection?.status === ConnectionStatus.Connected,
    configured: true,
    connection,
    mailAccess: Boolean(connection?.scopes.includes(GOOGLE_MAIL_SCOPE)),
    calendarAccess: Boolean(connection?.scopes.includes(GOOGLE_CALENDAR_SCOPE)),
  };
}

export function createInMemoryIntegrations(options: InMemoryIntegrationOptions): InMemoryIntegrations {
  const { clock, respond } = options;
  let connection = options.connection;
  return {
    simulateConnected(email, scopes = [GOOGLE_MAIL_SCOPE, GOOGLE_CALENDAR_SCOPE]) {
      connection = { provider: IntegrationProvider.Google, email, status: ConnectionStatus.Connected, scopes, connectedAt: clock.now().toISOString() };
    },
    googleStatus: () => respond(statusOf(connection)),
    googleAuthorizeUrl: () => respond({ url: TEST_AUTHORIZE_URL }),
    async syncGoogle() {
      if (connection) {
        connection = { ...connection, lastSyncAt: clock.now().toISOString() };
      }
      return respond({ messages: 0, events: 0 });
    },
    async disconnectGoogle() {
      connection = undefined;
      return respond(undefined);
    },
  };
}
