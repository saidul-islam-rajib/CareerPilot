import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { ConnectionStatus, IntegrationProvider, SyncFailure } from '@careerpilot/domain-ui-logic';
import { navigation, renderAdmin } from '@/test/render';
import { UserPage } from './user-page';

describe('everything about a user', () => {
  it('shows applications with their timeline and lets admins change and archive them', async () => {
    navigation.params = { id: 'usr_demo' };
    const { services } = await renderAdmin(<UserPage />, { params: { id: 'usr_demo' } });
    expect(await screen.findByRole('tab', { name: /Applications/ })).toHaveAttribute('aria-selected', 'true');
    const details = (await screen.findAllByRole('button', { name: 'Show timeline and emails' }))[0]!;
    fireEvent.click(details);
    expect(await screen.findByText('What was sent')).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: 'Change status' })[0]!);
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Note'), { target: { value: 'Withdrawn at the user request' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    const record = await services.api.users.getRecord('usr_demo');
    expect(record.applications.some((a) => a.timeline.some((entry) => entry.text === 'Withdrawn at the user request'))).toBe(true);
  });

  it('shows the job lists, profile, and sign-ins in their own tabs', async () => {
    await renderAdmin(<UserPage />, { params: { id: 'usr_demo' } });
    fireEvent.mouseDown(await screen.findByRole('tab', { name: /Job lists/ }));
    expect(await screen.findAllByRole('button', { name: 'Remove from list' })).not.toHaveLength(0);
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Profile and settings' }));
    expect(await screen.findByRole('heading', { name: 'Profile' })).toBeInTheDocument();
    const details = screen.getByRole('region', { name: 'Experience' });
    expect(within(details).getAllByText('Job title').length).toBeGreaterThan(0);
    expect(within(screen.getByRole('region', { name: 'Languages' })).getAllByText('Native').length).toBeGreaterThan(0);
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Activity and sessions' }));
    expect(await screen.findByRole('heading', { name: 'Never signed in' })).toBeInTheDocument();
    expect(screen.getByText(/No sessions recorded yet/)).toBeInTheDocument();
    expect(await screen.findAllByText(/Signed in|Failed attempt/)).not.toHaveLength(0);
  });

  it('messages the member as the team, lists connections, and shows files and contacts', async () => {
    const { services } = await renderAdmin(<UserPage />, { params: { id: 'usr_demo' } });
    fireEvent.mouseDown(await screen.findByRole('tab', { name: 'Messages' }));
    expect(await screen.findByText('No messages with this member yet.')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Write to this member'), { target: { value: 'Your CV looks great' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    expect(await screen.findByText('Your CV looks great', { selector: 'p' })).toBeInTheDocument();
    expect((await services.api.users.teamMessages('usr_demo')).messages).toHaveLength(1);
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Connections' }));
    expect(await screen.findByText("This member hasn't chatted with anyone yet.")).toBeInTheDocument();
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Files and contacts' }));
    expect(await screen.findByRole('heading', { name: 'CVs and documents' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Contact details' })).toBeInTheDocument();
  });

  it('replies to a chosen message in the team chat, and Esc cancels the reply', async () => {
    const { services } = await renderAdmin(<UserPage />, { params: { id: 'usr_demo' } });
    await services.api.users.sendTeamMessage('usr_demo', 'Please upload your CV');
    fireEvent.mouseDown(await screen.findByRole('tab', { name: 'Messages' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Reply' }));
    expect(screen.getByText('Replying to You')).toBeInTheDocument();
    fireEvent.keyDown(screen.getByLabelText('Write to this member'), { key: 'Escape' });
    expect(screen.queryByText('Replying to You')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Reply' }));
    fireEvent.change(screen.getByLabelText('Write to this member'), { target: { value: 'Thanks, got it' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    expect(await screen.findByRole('button', { name: 'In reply to You: Please upload your CV' })).toBeInTheDocument();
    expect(screen.queryByText('Replying to You')).not.toBeInTheDocument();
    expect((await services.api.users.teamMessages('usr_demo')).messages.at(-1)?.replyTo?.text).toBe('Please upload your CV');
  });

  it('lists connected accounts on the connections tab without any token', async () => {
    await renderAdmin(<UserPage />, {
      params: { id: 'usr_demo' },
      prepare: async (services) => {
        services.api.users.connectedAccounts = async () => [
          {
            provider: IntegrationProvider.Google,
            email: 'ayesha@gmail.com',
            status: ConnectionStatus.NeedsReconnect,
            scopes: [],
            connectedAt: '2026-10-20T06:00:00.000Z',
            lastSyncAt: '2026-10-20T07:00:00.000Z',
            lastError: SyncFailure.TokenRevoked,
          },
        ];
      },
    });
    fireEvent.mouseDown(await screen.findByRole('tab', { name: 'Connections' }));
    expect(await screen.findByRole('heading', { name: 'Connected accounts' })).toBeInTheDocument();
    expect(screen.getByText('ayesha@gmail.com')).toBeInTheDocument();
    expect(screen.getByText('Needs reconnecting')).toBeInTheDocument();
    expect(screen.getByText('Google access ended. Reconnect to continue.')).toBeInTheDocument();
    expect(screen.getByText('Sign-in tokens are never shown.')).toBeInTheDocument();
  });

  it('says when a member has not connected any account, and links to the email behind a reply', async () => {
    await renderAdmin(<UserPage />, { params: { id: 'usr_demo' } });
    const details = (await screen.findAllByRole('button', { name: 'Show timeline and emails' }))[0]!;
    fireEvent.click(details);
    expect((await screen.findAllByRole('link', { name: 'Open email' }))[0]).toHaveAttribute('href', 'https://mail.google.com/mail/u/0/#all/demo-interview');
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Connections' }));
    expect(await screen.findByText('No connected accounts.')).toBeInTheDocument();
  });
});
