import { fireEvent, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { TEST_AUTHORIZE_URL, type InMemoryIntegrations } from '@careerpilot/api-client';
import { createMemoryStore } from '@careerpilot/client-core';
import { createTestServices, renderWithProviders, testNow } from '@/test/render';
import { NotificationKind, NotificationTarget } from '@careerpilot/domain-ui-logic';
import { notificationHref } from '@/features/messaging/notifications-page';
import { ConnectedAccountsPage } from './connected-accounts-page';

const openAddress = vi.hoisted(() => vi.fn());
vi.mock('@/core/open-address', () => ({ openAddress }));

function connectedServices() {
  const services = createTestServices(createMemoryStore({}), { now: () => new Date(testNow) });
  (services.api.integrations as InMemoryIntegrations).simulateConnected('ayesha@gmail.com');
  return services;
}

describe('ConnectedAccountsPage', () => {
  beforeEach(() => openAddress.mockClear());

  it('offers to connect Google and sends the browser to the address the server made', async () => {
    renderWithProviders(<ConnectedAccountsPage />);
    expect(await screen.findByText('Not connected')).toBeInTheDocument();
    expect(screen.getByText(/only reads your email/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Connect Google' }));
    await waitFor(() => expect(openAddress).toHaveBeenCalledWith(TEST_AUTHORIZE_URL));
  });

  it('shows the connected account, checks the inbox now, and disconnects after confirming', async () => {
    renderWithProviders(<ConnectedAccountsPage />, { services: connectedServices() });
    expect(await screen.findByText('Connected as ayesha@gmail.com')).toBeInTheDocument();
    expect(screen.getByText('Not checked yet.')).toBeInTheDocument();
    expect(screen.getAllByText('Allowed')).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: 'Check now' }));
    expect(await screen.findByText('Checked: 0 new replies, 0 calendar changes.')).toBeInTheDocument();
    expect(await screen.findByText(/Last checked/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Disconnect' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Disconnect', hidden: false }));
    expect(await screen.findByRole('button', { name: 'Connect Google' })).toBeInTheDocument();
  });

  it('explains how the connection went when Google sends the browser back', async () => {
    const success = renderWithProviders(<ConnectedAccountsPage />, { search: 'google=connected' });
    expect(await screen.findByText('Google is connected.')).toBeInTheDocument();
    success.unmount();
    renderWithProviders(<ConnectedAccountsPage />, { search: 'google=error&reason=access_denied' });
    expect(await screen.findByText("We couldn't connect Google. You didn't allow access.")).toBeInTheDocument();
  });
});

describe('integration notifications', () => {
  it('open the connected accounts page', () => {
    const notification = {
      id: 'ntf_1',
      kind: NotificationKind.IntegrationAttention,
      title: 'Reconnect Google',
      body: '',
      target: NotificationTarget.Integration,
      targetId: 'con_1',
      createdAt: '2026-10-31T00:00:00.000Z',
      read: false,
    };
    expect(notificationHref(notification)).toBe('/settings/connected-accounts');
  });
});
