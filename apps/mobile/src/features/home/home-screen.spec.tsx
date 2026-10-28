import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { PauseDuration } from '@careerpilot/domain-ui-logic';
import { createTestServices, mockRouter, renderWithProviders } from '@/test/render';
import { AddJobByLinkScreen } from '@/features/opportunities/add-job-by-link-screen';
import { HomeScreen } from './home-screen';

describe('HomeScreen', () => {
  it('shows the greeting, counts, and matches per track', async () => {
    await renderWithProviders(<HomeScreen />);
    expect(await screen.findByText('Hello, Ayesha')).toBeTruthy();
    expect(screen.getByText('Remote jobs')).toBeTruthy();
    expect(screen.getByText('Government jobs in Bangladesh')).toBeTruthy();
    expect(screen.getByText('On-site jobs in Bangladesh')).toBeTruthy();
    expect(screen.getByText("Master's in Europe")).toBeTruthy();
    expect(screen.getByText('Senior Frontend Engineer')).toBeTruthy();
    expect(screen.getByLabelText('Awaiting approval: 2')).toBeTruthy();
    expect(screen.getByText('Coming up')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText(/First interview with the engineering manager/));
    expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/application/[id]', params: { id: 'app_bay' } });
  });

  it('filters by a suggested company, collapses a track, and favorites a company', async () => {
    const services = createTestServices();
    await renderWithProviders(<HomeScreen />, { services });
    await fireEvent(await screen.findByTestId('today-search'), 'focus');
    await fireEvent.changeText(screen.getByTestId('today-search'), 'north');
    await fireEvent.press(await screen.findByTestId('suggestion-Northwind Labs'));
    expect(screen.getByText(/jobs? match/)).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId('today-search'), '');
    await fireEvent.press(screen.getAllByLabelText('Add Northwind Labs to favorites')[0]!);
    await waitFor(async () => expect((await services.api.settings.getSettings()).favoriteCompanies).toEqual(['Northwind Labs']));
    await fireEvent.press(screen.getByLabelText('Hide Remote jobs'));
    expect(screen.getByLabelText('Show Remote jobs')).toBeTruthy();
  });

  it('opens an opportunity', async () => {
    await renderWithProviders(<HomeScreen />);
    await fireEvent.press(await screen.findByLabelText(/Senior Frontend Engineer, Northwind Labs/));
    expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/opportunity/[id]', params: { id: 'opp_remote_frontend' } });
  });

  it('shows the pause banner and resumes', async () => {
    const { services } = await renderWithProviders(<HomeScreen />);
    await services.api.settings.pause({ duration: PauseDuration.Indefinite });
    const view = await renderWithProviders(<HomeScreen />, { services });
    expect(await view.findByText('Automatic applications are paused')).toBeTruthy();
    await fireEvent.press(view.getByText('Resume'));
    await view.findByText('Hello, Ayesha');
    expect(await services.api.settings.getSettings()).not.toHaveProperty('pause');
  });
});

describe('AddJobByLinkScreen', () => {
  it('reads a pasted job link and opens the job', async () => {
    await renderWithProviders(<AddJobByLinkScreen />);
    await fireEvent.press(await screen.findByTestId('job-link-submit'));
    expect(await screen.findByText('This field is required.')).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId('job-link-url'), 'careers.example.com/northwind/senior-frontend');
    await fireEvent.press(screen.getByTestId('job-link-submit'));
    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith({ pathname: '/opportunity/[id]', params: { id: 'opp_remote_frontend' } }));
  });
});
