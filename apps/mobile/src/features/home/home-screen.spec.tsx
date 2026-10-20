import { fireEvent, screen } from '@testing-library/react-native';
import { PauseDuration } from '@careerpilot/domain-ui-logic';
import { mockRouter, renderWithProviders } from '@/test/render';
import { HomeScreen } from './home-screen';

describe('HomeScreen', () => {
  it('shows the greeting, counts, and matches per track', async () => {
    renderWithProviders(<HomeScreen />);
    expect(await screen.findByText('Hello, Ayesha')).toBeTruthy();
    expect(screen.getByText('Remote jobs')).toBeTruthy();
    expect(screen.getByText('Bangladesh government')).toBeTruthy();
    expect(screen.getByText("Master's in Europe")).toBeTruthy();
    expect(screen.getByText('Senior Frontend Engineer')).toBeTruthy();
    expect(screen.getByLabelText('Awaiting approval: 2')).toBeTruthy();
  });

  it('opens an opportunity', async () => {
    renderWithProviders(<HomeScreen />);
    fireEvent.press(await screen.findByLabelText(/Senior Frontend Engineer, Northwind Labs/));
    expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/opportunity/[id]', params: { id: 'opp_remote_frontend' } });
  });

  it('shows the pause banner and resumes', async () => {
    const { services } = renderWithProviders(<HomeScreen />);
    await services.api.settings.pause({ duration: PauseDuration.Indefinite });
    const view = renderWithProviders(<HomeScreen />, { services });
    expect(await view.findByText('Automatic applications are paused')).toBeTruthy();
    fireEvent.press(view.getByText('Resume'));
    await view.findByText('Hello, Ayesha');
    expect(await services.api.settings.getSettings()).not.toHaveProperty('pause');
  });
});
