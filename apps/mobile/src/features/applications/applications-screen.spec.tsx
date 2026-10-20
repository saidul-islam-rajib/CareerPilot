import { fireEvent, screen } from '@testing-library/react-native';
import { mockParams, mockRouter, renderWithProviders } from '@/test/render';
import { ApplicationScreen } from './application-screen';
import { ApplicationsScreen } from './applications-screen';

describe('ApplicationsScreen', () => {
  it('lists applications with submission and outcome statuses', async () => {
    renderWithProviders(<ApplicationsScreen />);
    expect(await screen.findByText('Software Engineer')).toBeTruthy();
    expect(screen.getAllByText('Confirmed').length).toBeGreaterThan(0);
    expect(screen.getByText('Interview')).toBeTruthy();
  });

  it('filters applications that need attention', async () => {
    renderWithProviders(<ApplicationsScreen />);
    await screen.findByText('Software Engineer');
    fireEvent.press(screen.getByRole('tab', { name: 'Needs attention' }));
    expect(await screen.findByText('Outcome unknown')).toBeTruthy();
    expect(screen.getByText('Manual action required')).toBeTruthy();
    expect(screen.queryByText('Software Engineer')).toBeNull();
  });

  it('opens a submission record', async () => {
    renderWithProviders(<ApplicationsScreen />);
    fireEvent.press(await screen.findByLabelText(/Software Engineer, Bay Digital Ltd/));
    expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/application/[id]', params: { id: 'app_bay' } });
  });
});

describe('ApplicationScreen', () => {
  it('shows the full submission record', async () => {
    mockParams.current = { id: 'app_bay' };
    renderWithProviders(<ApplicationScreen />);
    expect(await screen.findByText('Email sent to careers@baydigital.example.com')).toBeTruthy();
    expect(screen.getByText('Application: Software Engineer – Ayesha Rahman')).toBeTruthy();
    expect(screen.getByText('Email delivered; no bounce received within 48 hours')).toBeTruthy();
    expect(screen.getByText('Ayesha-Rahman-CV.pdf')).toBeTruthy();
  });

  it('says when no confirmation has been received', async () => {
    mockParams.current = { id: 'app_meghna' };
    renderWithProviders(<ApplicationScreen />);
    expect(await screen.findByText('No confirmation received yet.')).toBeTruthy();
  });
});
