import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { mockParams, mockRouter, renderWithProviders } from '@/test/render';
import { ApplicationScreen } from './application-screen';
import { ApplicationsScreen } from './applications-screen';
import { FollowUpScreen, OutcomeScreen } from './follow-up-screens';

describe('ApplicationsScreen', () => {
  it('lists applications with submission and outcome statuses', async () => {
    await renderWithProviders(<ApplicationsScreen />);
    expect(await screen.findByText('Software Engineer')).toBeTruthy();
    expect(screen.getAllByText('Confirmed').length).toBeGreaterThan(0);
    expect(screen.getByText('Interview')).toBeTruthy();
  });

  it('filters applications that need attention', async () => {
    await renderWithProviders(<ApplicationsScreen />);
    await screen.findByText('Software Engineer');
    await fireEvent.press(screen.getByRole('tab', { name: 'Needs attention' }));
    expect(await screen.findByText('Outcome unknown')).toBeTruthy();
    expect(screen.getByText('Manual action required')).toBeTruthy();
    expect(screen.queryByText('Software Engineer')).toBeNull();
  });

  it('opens a submission record', async () => {
    await renderWithProviders(<ApplicationsScreen />);
    await fireEvent.press(await screen.findByLabelText(/Software Engineer, Bay Digital Ltd/));
    expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/application/[id]', params: { id: 'app_bay' } });
  });
});

describe('ApplicationScreen', () => {
  it('shows the full submission record', async () => {
    mockParams.current = { id: 'app_bay' };
    await renderWithProviders(<ApplicationScreen />);
    expect(await screen.findByText('Email sent to careers@baydigital.example.com')).toBeTruthy();
    expect(screen.getByText('Application: Software Engineer – Ayesha Rahman')).toBeTruthy();
    expect(screen.getByText('Email delivered; no bounce received within 48 hours')).toBeTruthy();
    expect(screen.getByText('Ayesha-Rahman-CV.pdf')).toBeTruthy();
  });

  it('points to the employer site when only the user can finish the application', async () => {
    mockParams.current = { id: 'app_harbour' };
    await renderWithProviders(<ApplicationScreen />);
    expect(await screen.findByText("Finish this application on the employer's site")).toBeTruthy();
    expect(screen.getByTestId('open-application-page')).toBeTruthy();
  });

  it('says when no confirmation has been received', async () => {
    mockParams.current = { id: 'app_meghna' };
    await renderWithProviders(<ApplicationScreen />);
    expect(await screen.findByText('No confirmation received yet.')).toBeTruthy();
  });
});

describe('Follow-up screens', () => {
  it('shows follow-ups on the application and opens the editors', async () => {
    mockParams.current = { id: 'app_bay' };
    await renderWithProviders(<ApplicationScreen />);
    expect(await screen.findByText('First interview with the engineering manager')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('add-follow-up'));
    expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/follow-up', params: { applicationId: 'app_bay' } });
    await fireEvent.press(screen.getByTestId('update-outcome'));
    expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/outcome', params: { id: 'app_bay' } });
  });

  it('adds a follow-up in the user time zone', async () => {
    mockParams.current = { applicationId: 'app_kite' };
    const { services } = await renderWithProviders(<FollowUpScreen />);
    await fireEvent.press(await screen.findByRole('radio', { name: 'Interview' }));
    await fireEvent.changeText(screen.getByTestId('task-time'), '10:00');
    await fireEvent.press(screen.getByTestId('task-save'));
    expect(await screen.findByText('This field is required.')).toBeTruthy();
    expect(screen.getByText('Choose a date for this time.')).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId('task-title'), 'Video interview');
    await fireEvent.changeText(screen.getByTestId('task-date'), '2026-10-22');
    await fireEvent.press(screen.getByTestId('task-save'));
    await waitFor(async () => expect((await services.api.applications.getApplication('app_kite')).tasks.at(-1)).toMatchObject({ kind: 'interview', title: 'Video interview', dueAt: '2026-10-22T04:00:00.000Z' }));
    await waitFor(() => expect(mockRouter.back).toHaveBeenCalled());
  });

  it('updates the outcome with a note', async () => {
    mockParams.current = { id: 'app_kite' };
    const { services } = await renderWithProviders(<OutcomeScreen />);
    await fireEvent.press(await screen.findByRole('radio', { name: 'Withdrawn' }));
    expect(screen.getByText(/doesn't tell the employer/)).toBeTruthy();
    await fireEvent.press(screen.getByRole('radio', { name: 'Offer received' }));
    await fireEvent.changeText(screen.getByTestId('outcome-note'), 'Verbal offer');
    await fireEvent.press(screen.getByTestId('outcome-save'));
    await waitFor(async () => expect((await services.api.applications.getApplication('app_kite')).outcomeStatus).toBe('offer_received'));
    await waitFor(() => expect(mockRouter.back).toHaveBeenCalled());
  });
});
