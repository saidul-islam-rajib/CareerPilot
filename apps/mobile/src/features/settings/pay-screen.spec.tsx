import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { createTestServices, renderWithProviders } from '@/test/render';
import { PayScreen } from './pay-screen';

describe('pay screen', () => {
  it('rejects a bad amount and saves a valid minimum', async () => {
    const services = createTestServices();
    const { unmount } = await renderWithProviders(<PayScreen />, { services });
    await fireEvent.changeText(await screen.findByLabelText('Minimum pay'), 'lots');
    await fireEvent.press(screen.getByTestId('pay-save'));
    expect(await screen.findByText('Enter a number such as 50000.')).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('Minimum pay'), '50000');
    await fireEvent.press(screen.getByTestId('pay-save'));
    await waitFor(async () => expect((await services.api.settings.getSettings()).compensation.minimum?.amountMinor).toBe(5_000_000));
    await unmount();
  });
});
