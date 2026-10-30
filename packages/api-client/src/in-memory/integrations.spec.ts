import { describe, expect, it } from 'vitest';
import { ConnectionStatus } from '@careerpilot/domain-ui-logic';
import { createInMemoryIntegrations, GOOGLE_MAIL_SCOPE, TEST_AUTHORIZE_URL } from './integrations';

const clock = { now: () => new Date('2026-10-31T06:00:00.000Z') };
const respond = <T>(value: T) => Promise.resolve(value);

describe('in-memory integrations', () => {
  it('starts disconnected with a sign-in address ready', async () => {
    const api = createInMemoryIntegrations({ clock, respond });
    expect(await api.googleStatus()).toMatchObject({ connected: false, configured: true, mailAccess: false });
    expect((await api.googleAuthorizeUrl()).url).toBe(TEST_AUTHORIZE_URL);
  });

  it('reports access by scope, checks the inbox, and disconnects', async () => {
    const api = createInMemoryIntegrations({ clock, respond });
    api.simulateConnected('ayesha@gmail.com', [GOOGLE_MAIL_SCOPE]);
    const status = await api.googleStatus();
    expect(status).toMatchObject({ connected: true, mailAccess: true, calendarAccess: false });
    expect(status.connection?.status).toBe(ConnectionStatus.Connected);
    await api.syncGoogle();
    expect((await api.googleStatus()).connection?.lastSyncAt).toBe('2026-10-31T06:00:00.000Z');
    await api.disconnectGoogle();
    expect((await api.googleStatus()).connection).toBeUndefined();
  });
});
