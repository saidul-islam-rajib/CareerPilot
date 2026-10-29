import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { mockParams, mockRouter, renderWithProviders } from '@/test/render';
import { ApplicationScreen } from '@/features/applications/application-screen';
import { ChatsScreen } from './chats-screen';
import { ConversationScreen } from './conversation-screen';
import { InboxScreen } from './inbox-screen';

describe('ChatsScreen', () => {
  it('lists chats with unread counts and starts a chat with a found member', async () => {
    await renderWithProviders(<ChatsScreen />);
    expect(await screen.findByText('Karim Hasan')).toBeTruthy();
    expect(screen.getByLabelText('Karim Hasan, 1 unread')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('new-chat'));
    await fireEvent.changeText(screen.getByTestId('member-search'), 'nadia');
    await fireEvent.press(await screen.findByTestId('message-usr_nadia'));
    await waitFor(() => expect(mockRouter.push).toHaveBeenCalledWith(expect.objectContaining({ pathname: '/chat/[id]' })));
  });
});

describe('ConversationScreen', () => {
  it('reads the chat and sends a message that shows a sent tick', async () => {
    mockParams.current = { id: 'cnv_karim' };
    const { services } = await renderWithProviders(<ConversationScreen />);
    expect(await screen.findByText(/our team is hiring a frontend engineer/)).toBeTruthy();
    await waitFor(async () => expect((await services.api.messaging.inbox()).unreadMessages).toBe(0));
    await fireEvent.changeText(screen.getByTestId('message-input'), 'Sounds great, tell me more');
    await fireEvent.press(screen.getByTestId('message-send'));
    expect(await screen.findByText('Sounds great, tell me more')).toBeTruthy();
    expect(screen.getAllByTestId('ticks-sent').length).toBeGreaterThan(0);
  });

  it('blocks the member and hides the composer', async () => {
    mockParams.current = { id: 'cnv_karim' };
    await renderWithProviders(<ConversationScreen />);
    await screen.findByText(/our team is hiring/);
    await fireEvent.press(screen.getByTestId('conversation-block'));
    expect(await screen.findByText('You blocked this member. Unblock to send messages.')).toBeTruthy();
  });
});

describe('InboxScreen', () => {
  it('opens a notification and marks all read', async () => {
    await renderWithProviders(<InboxScreen />);
    await fireEvent.press(await screen.findByTestId('notification-ntf_1'));
    expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/chat/[id]', params: { id: 'cnv_karim' } });
  });
});

describe('ApplicationScreen submitted on the employer site', () => {
  it('records the submission after confirming', async () => {
    mockParams.current = { id: 'app_harbour' };
    const { services } = await renderWithProviders(<ApplicationScreen />);
    await fireEvent.press(await screen.findByTestId('submitted-it'));
    await fireEvent.press(screen.getByTestId('submitted-confirm'));
    await waitFor(async () => expect((await services.api.applications.getApplication('app_harbour')).submissionStatus).toBe('submitted_awaiting_confirmation'));
    expect((await services.api.messaging.notifications())[0]?.kind).toBe('application_submitted');
  });
});
