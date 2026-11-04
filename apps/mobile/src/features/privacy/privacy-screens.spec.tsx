import * as WebBrowser from 'expo-web-browser';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { renderWithProviders } from '@/test/render';
import { ConsentsScreen } from './consents-screen';
import { ExportsScreen } from './exports-screen';
import { ReportsScreen } from './reports-screen';

describe('privacy screens', () => {
  beforeEach(() => jest.mocked(WebBrowser.openBrowserAsync).mockClear());

  it('requests an export and opens the download in the system browser', async () => {
    const { unmount } = await renderWithProviders(<ExportsScreen />);
    expect(await screen.findByText('No exports yet.')).toBeTruthy();
    await fireEvent.press(screen.getByText('Applications as CSV'));
    await fireEvent.press(await screen.findByText('Download'));
    await waitFor(() => expect(WebBrowser.openBrowserAsync).toHaveBeenCalledWith('https://files.example.test/export'));
    await unmount();
  });

  it('shows required consents as fixed and lets optional ones change', async () => {
    const { unmount } = await renderWithProviders(<ConsentsScreen />);
    expect((await screen.findAllByText('Terms of Service')).length).toBeGreaterThan(0);
    await fireEvent(screen.getByTestId('consent-marketing'), 'valueChange', true);
    await waitFor(() => expect(screen.getAllByText(/Allowed on/).length).toBe(3));
    await unmount();
  });

  it('shows the daily report and switches to weekly', async () => {
    const { unmount } = await renderWithProviders(<ReportsScreen />);
    expect(await screen.findByText('No application activity in this period.')).toBeTruthy();
    await fireEvent.press(screen.getByText('Weekly'));
    expect(await screen.findByText('No application activity in this period.')).toBeTruthy();
    await unmount();
  });
});
