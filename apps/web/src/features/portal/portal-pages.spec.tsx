import { fireEvent, screen, waitFor } from '@testing-library/react';
import { createMemoryStore } from '@careerpilot/client-core';
import { AttemptState, StopReason } from '@careerpilot/domain-ui-logic';
import { createTestServices, renderWithProviders, testNow } from '@/test/render';
import { AttemptPanel } from './attempt-panel';
import { AutopilotPage } from './autopilot-page';
import { PortalAccountsPage } from './portal-accounts-page';

function seededServices() {
  return createTestServices(createMemoryStore({}), { now: () => new Date(testNow) });
}

describe('portal pages', () => {
  it('starts off and turns on only after the summary is acknowledged', async () => {
    const services = seededServices();
    renderWithProviders(<AutopilotPage />, { services });
    expect(await screen.findByText(/Autopilot is off/)).toBeInTheDocument();
    const turnOn = screen.getByRole('button', { name: 'Turn on Autopilot' });
    expect(turnOn).toBeDisabled();
    fireEvent.click(screen.getByLabelText(/I have read what Autopilot may submit/));
    fireEvent.click(screen.getByRole('button', { name: 'Turn on Autopilot' }));
    expect(await screen.findByText(/Autopilot is on/)).toBeInTheDocument();
  });

  it('saves a portal account and shows the password only on request', async () => {
    const services = seededServices();
    await services.api.portal.addAccount({ host: 'jobs.example.com', employer: 'Acme', email: 'me@example.com', password: 'secret-pw' });
    renderWithProviders(<PortalAccountsPage />, { services });
    expect(await screen.findByText('Acme')).toBeInTheDocument();
    expect(screen.queryByText(/secret-pw/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Show password' }));
    expect(await screen.findByText(/secret-pw/)).toBeInTheDocument();
  });

  it('shows the stop reason, prepared answers and lets the user mark it done', async () => {
    const services = seededServices();
    const application = (await services.api.applications.listApplications('all'))[0];
    const attempt = {
      applicationId: application.id,
      state: AttemptState.Stopped,
      stop: StopReason.UnknownQuestion,
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
    renderWithProviders(<AttemptPanel applicationId={application.id} enabled />, { services });
    expect(await screen.findByText(/A required question has no approved answer/)).toBeInTheDocument();
    expect(screen.getByText(/Full name: Test User/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open the official page' })).toHaveAttribute('href', attempt.officialUrl);
    expect(screen.getByRole('button', { name: 'Resume Autopilot' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'I finished it on the site' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'I finished it on the site' })).toBeInTheDocument());
  });
});
