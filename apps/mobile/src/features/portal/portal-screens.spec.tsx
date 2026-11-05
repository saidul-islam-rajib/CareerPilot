import { fireEvent, screen } from '@testing-library/react-native';
import { AttemptState, StopReason } from '@careerpilot/domain-ui-logic';
import { createTestServices, renderWithProviders } from '@/test/render';
import { AttemptPanel } from './attempt-panel';
import { AutopilotScreen } from './autopilot-screen';
import { PortalAccountsScreen } from './portal-accounts-screen';

describe('portal screens', () => {
  it('starts off and turns on after the summary is acknowledged', async () => {
    const services = createTestServices();
    const { unmount } = await renderWithProviders(<AutopilotScreen />, { services });
    expect(await screen.findByText(/Autopilot is off/)).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('I have read what Autopilot may submit and what stays with me.'));
    await fireEvent.press(screen.getByTestId('autopilot-turn-on'));
    expect(await screen.findByText(/Autopilot is on/)).toBeTruthy();
    expect((await services.api.portal.autopilot()).settings.enabled).toBe(true);
    await unmount();
  });

  it('lists accounts and reveals the password only on request', async () => {
    const services = createTestServices();
    await services.api.portal.addAccount({ host: 'jobs.example.com', employer: 'Acme', email: 'me@example.com', password: 'secret-pw' });
    const { unmount } = await renderWithProviders(<PortalAccountsScreen />, { services });
    expect(await screen.findByText('Acme')).toBeTruthy();
    expect(screen.queryByText(/secret-pw/)).toBeNull();
    await fireEvent.press(screen.getByText('Show password'));
    expect(await screen.findByText(/secret-pw/)).toBeTruthy();
    await unmount();
  });

  it('shows the stop reason and prepared answers', async () => {
    const services = createTestServices();
    const application = (await services.api.applications.listApplications('all'))[0];
    const attempt = {
      applicationId: application.id,
      state: AttemptState.Stopped,
      stop: StopReason.Captcha,
      detail: '',
      officialUrl: 'https://jobs.example.com/apply',
      host: 'jobs.example.com',
      prepared: [{ label: 'Full name', value: 'Test User' }],
      pending: [],
      submitClicked: false,
      runs: 1,
      finalUrl: '',
      confirmationText: '',
      evidenceKey: '',
      updatedAt: '',
    };
    (services.api.portal as unknown as { seedAttempt: (view: typeof attempt) => void }).seedAttempt(attempt);
    const { unmount } = await renderWithProviders(<AttemptPanel applicationId={application.id} />, { services });
    expect(await screen.findByText(/visible CAPTCHA/)).toBeTruthy();
    expect(screen.getByText(/Full name: Test User/)).toBeTruthy();
    expect(screen.getByTestId('portal-resume')).toBeTruthy();
    expect(screen.getByTestId('portal-complete')).toBeTruthy();
    await unmount();
  });
});
