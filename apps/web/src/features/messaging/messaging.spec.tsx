import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { navigation, renderWithProviders } from '@/test/render';
import { ApplicationPage } from '@/features/applications/application-page';
import { ChatsPage } from './chats-page';
import { ConversationPage } from './conversation-page';
import { NotificationsPage } from './notifications-page';

describe('ChatsPage', () => {
  it('lists chats with unread counts and finds members to message', async () => {
    renderWithProviders(<ChatsPage />);
    expect(await screen.findByText('Karim Hasan')).toBeInTheDocument();
    expect(screen.getByLabelText('1 unread')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'New chat' }));
    fireEvent.change(screen.getByLabelText('Find members'), { target: { value: 'nad' } });
    fireEvent.click(await screen.findByRole('button', { name: 'Message Nadia Islam' }));
    await waitFor(() => expect(navigation.push).toHaveBeenCalledWith(expect.stringMatching(/^\/messages\/cnv_/)));
  });
});

describe('ConversationPage', () => {
  it('shows the conversation, marks it read, and sends a message', async () => {
    const { services } = renderWithProviders(<ConversationPage />, { params: { id: 'cnv_karim' } });
    expect(await screen.findByText(/our team is hiring a frontend engineer/)).toBeInTheDocument();
    await waitFor(async () => expect((await services.api.messaging.inbox()).unreadMessages).toBe(0));
    fireEvent.change(screen.getByLabelText('Type a message'), { target: { value: 'Yes, I would love to hear more!' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    expect(await screen.findByText('Yes, I would love to hear more!', { selector: 'p' })).toBeInTheDocument();
    expect(screen.getAllByRole('img', { name: 'Sent' }).length).toBeGreaterThan(0);
  });

  it('blocks a member from the menu and replaces the composer', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ConversationPage />, { params: { id: 'cnv_karim' } });
    await user.click(await screen.findByRole('button', { name: 'More' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Block' }));
    expect(await screen.findByText('You blocked this member. Unblock to send messages.')).toBeInTheDocument();
  });
});

describe('NotificationsPage', () => {
  it('opens a notification and marks everything read', async () => {
    renderWithProviders(<NotificationsPage />);
    const link = await screen.findByRole('link', { name: /Karim Hasan/ });
    expect(link).toHaveAttribute('href', '/messages/cnv_karim');
    fireEvent.click(screen.getByRole('button', { name: 'Mark all as read' }));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Mark all as read' })).not.toBeInTheDocument());
  });
});

describe('ApplicationPage submitted on the employer site', () => {
  it('records the submission after the user confirms', async () => {
    const { services } = renderWithProviders(<ApplicationPage />, { params: { id: 'app_harbour' } });
    fireEvent.click(await screen.findByRole('button', { name: 'I submitted it' }));
    const dialog = await screen.findByRole('alertdialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Yes, I submitted it' }));
    await waitFor(async () => expect((await services.api.applications.getApplication('app_harbour')).submissionStatus).toBe('submitted_awaiting_confirmation'));
    const [latest] = await services.api.messaging.notifications();
    expect(latest?.kind).toBe('application_submitted');
  });
});
