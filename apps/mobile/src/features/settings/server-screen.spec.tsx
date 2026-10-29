import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { SERVER_ADDRESS_KEY } from '@careerpilot/client-core';
import { createTestServices, mockRouter, renderWithProviders } from '@/test/render';
import { ServerScreen } from './server-screen';

describe('ServerScreen', () => {
  it('checks a new computer address, then saves and uses it', async () => {
    const services = createTestServices(false);
    services.probeServer = jest.fn(async () => true);
    await renderWithProviders(<ServerScreen />, { services });
    await fireEvent.changeText(await screen.findByTestId('server-address'), '192.168.0.106');
    await fireEvent.press(screen.getByTestId('server-save'));
    await waitFor(() => expect(mockRouter.back).toHaveBeenCalled());
    const port = new URL(services.config.api.baseUrl).port;
    const expected = `http://192.168.0.106${port ? `:${port}` : ''}`;
    expect(services.probeServer).toHaveBeenCalledWith(expected);
    expect(services.server.current()).toBe(expected);
    expect(await services.store.get(SERVER_ADDRESS_KEY)).toBe(expected);
  });

  it('keeps the old address when nothing answers at the new one', async () => {
    const services = createTestServices(false);
    const before = services.server.current();
    services.probeServer = jest.fn(async () => false);
    await renderWithProviders(<ServerScreen />, { services });
    await fireEvent.changeText(await screen.findByTestId('server-address'), '10.0.0.9');
    await fireEvent.press(screen.getByTestId('server-save'));
    expect(await screen.findByText(/didn't answer at this address/)).toBeTruthy();
    expect(services.server.current()).toBe(before);
  });
});
