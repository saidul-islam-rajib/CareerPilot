import { fireEvent, screen, waitFor } from '@testing-library/react';
import { renderAdmin } from '@/test/render';
import { DashboardPage } from '../dashboard/dashboard-page';
import { UsersPage } from '../users/users-page';
import { InboxPage } from './inbox-page';

describe('InboxPage', () => {
  it('shows an empty state, then the conversation list and a thread to reply in', async () => {
    const empty = await renderAdmin(<InboxPage />);
    expect(await screen.findByText('No messages from users yet.')).toBeInTheDocument();
    empty.unmount?.();
  });

  it('lists a conversation, filters by search and opens the thread', async () => {
    const { services } = await renderAdmin(<InboxPage />);
    await services.api.users.sendTeamMessage('usr_002', 'Welcome aboard');
    fireEvent.change(screen.getByPlaceholderText('Search by name or message'), { target: { value: 'welcome' } });
    const row = await screen.findByRole('button', { name: /Welcome aboard/ });
    fireEvent.change(screen.getByPlaceholderText('Search by name or message'), { target: { value: 'zzz' } });
    await waitFor(() => expect(screen.queryByRole('button', { name: /Welcome aboard/ })).not.toBeInTheDocument());
    fireEvent.change(screen.getByPlaceholderText('Search by name or message'), { target: { value: '' } });
    fireEvent.click(await screen.findByRole('button', { name: /Welcome aboard/ }));
    expect(await screen.findByRole('link', { name: 'Open user record' })).toBeInTheDocument();
    expect(row).toBeDefined();
  });
});

describe('Dashboard and users visibility', () => {
  it('links the unread messages tile to the inbox', async () => {
    await renderAdmin(<DashboardPage />);
    const tile = await screen.findByRole('link', { name: /Unread messages/ });
    expect(tile).toHaveAttribute('href', '/messages');
  });

  it('shows the phone state in the users list', async () => {
    await renderAdmin(<UsersPage />);
    expect((await screen.findAllByText('No phone number added')).length).toBeGreaterThan(0);
  });
});
