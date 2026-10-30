import * as WebBrowser from 'expo-web-browser';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { TEST_AUTHORIZE_URL, type InMemoryIntegrations } from '@careerpilot/api-client';
import { renderWithProviders, createTestServices } from '@/test/render';
import { ConnectedAccountsScreen } from './connected-accounts-screen';

describe('ConnectedAccountsScreen', () => {
  beforeEach(() => jest.mocked(WebBrowser.openBrowserAsync).mockClear());

  it('opens the sign-in address in the system browser and explains the localhost limit', async () => {
    const { unmount } = await renderWithProviders(<ConnectedAccountsScreen />);
    expect(await screen.findByText(/only returns to localhost/)).toBeTruthy();
    await fireEvent.press(screen.getByTestId('google-connect'));
    await waitFor(() => expect(WebBrowser.openBrowserAsync).toHaveBeenCalledWith(TEST_AUTHORIZE_URL));
    await unmount();
  });

  it('shows the connected account, checks the inbox, and disconnects after confirming', async () => {
    const services = createTestServices();
    (services.api.integrations as InMemoryIntegrations).simulateConnected('ayesha@gmail.com');
    const { unmount } = await renderWithProviders(<ConnectedAccountsScreen />, { services });
    expect(await screen.findByText('Connected as ayesha@gmail.com')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('google-sync'));
    expect(await screen.findByText('Checked: 0 new replies, 0 calendar changes.')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('google-disconnect'));
    await fireEvent.press(await screen.findByTestId('google-disconnect-confirm'));
    expect(await screen.findByTestId('google-connect')).toBeTruthy();
    await unmount();
  });
});
