import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { ApplicationFilter } from '@careerpilot/api-client';
import { SubmissionStatus } from '@careerpilot/domain-ui-logic';
import { navigation, renderWithProviders } from '@/test/render';
import { ApplicationPage } from './applications/application-page';
import { ApplicationsPage } from './applications/applications-page';
import { ApprovalPage } from './approvals/approval-page';
import { ApprovalsPage } from './approvals/approvals-page';
import { HomePage } from './home/home-page';
import { CircularPage } from './opportunities/circular-page';
import { OpportunityPage } from './opportunities/opportunity-page';
import { ProfilePage } from './profile/profile-page';
import { AppShell } from './shell/app-shell';

describe('AppShell', () => {
  it('shows navigation with the pending approvals count and the credit', async () => {
    navigation.pathname = '/approvals';
    renderWithProviders(
      <AppShell>
        <p>content</p>
      </AppShell>,
    );
    const links = await screen.findAllByRole('link', { name: /Approvals/ });
    expect(links[0]).toHaveAttribute('aria-current', 'page');
    await waitFor(() => expect(links[0]).toHaveTextContent('2'));
    expect(screen.getAllByRole('link', { name: /Developed by Team Sober/ }).length).toBeGreaterThan(0);
  });
});

describe('HomePage', () => {
  it('shows counts and tracks', async () => {
    renderWithProviders(<HomePage />);
    expect(await screen.findByText('Hello, Ayesha')).toBeInTheDocument();
    expect(screen.getByLabelText('Awaiting approval: 2')).toHaveAttribute('href', '/approvals');
    expect(screen.getByRole('heading', { name: 'Bangladesh government' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Senior Frontend Engineer/ })).toHaveAttribute('href', '/opportunities/opp_remote_frontend');
  });
});

describe('OpportunityPage', () => {
  it('explains the match and prepares an application', async () => {
    const { services } = renderWithProviders(<OpportunityPage />, { params: { id: 'opp_bd_ctg' } });
    expect(await screen.findByRole('heading', { name: 'Lead QA Engineer' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Prepare application' }));
    expect(await screen.findByText(/You'll review it before anything is sent/)).toBeInTheDocument();
    expect((await services.api.approvals.listApprovals()).some((a) => a.opportunity.id === 'opp_bd_ctg')).toBe(true);
  });

  it('warns about a hard requirement failure', async () => {
    renderWithProviders(<OpportunityPage />, { params: { id: 'opp_gov_programmer' } });
    expect(await screen.findByText(/A hard requirement is not met/)).toBeInTheDocument();
  });

  it('shows the archived circular', async () => {
    renderWithProviders(<CircularPage />, { params: { id: 'opp_bd_dhaka' } });
    expect(await screen.findByText(/Salary: BDT 120,000/)).toBeInTheDocument();
  });
});

describe('Approvals', () => {
  it('lists pending approvals', async () => {
    renderWithProviders(<ApprovalsPage />);
    expect(await screen.findByText('2 waiting for your approval')).toBeInTheDocument();
  });

  it('edits an answer then approves after confirmation', async () => {
    const { services } = renderWithProviders(<ApprovalPage />, { params: { id: 'apr_frontend' } });
    await screen.findByText('What is your notice period?');
    fireEvent.click(screen.getAllByRole('button', { name: 'Edit' })[0]!);
    fireEvent.change(screen.getByLabelText('Edit answer'), { target: { value: '15 days' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('15 days')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Approve and send' }));
    const dialog = await screen.findByRole('alertdialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Confirm' }));
    expect(await screen.findByText(/complete the application automatically at 00:00–01:00/)).toBeInTheDocument();
    const active = await services.api.applications.listApplications(ApplicationFilter.Active);
    expect(active.find((a) => a.opportunity.id === 'opp_remote_frontend')?.submissionStatus).toBe(SubmissionStatus.ApprovedQueued);
  });
});

describe('Applications', () => {
  it('filters applications that need attention', async () => {
    renderWithProviders(<ApplicationsPage />);
    await screen.findByText('Software Engineer');
    fireEvent.click(screen.getByRole('radio', { name: 'Needs attention' }));
    expect(await screen.findByText('Outcome unknown')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText('Software Engineer')).not.toBeInTheDocument());
  });

  it('shows the full submission record', async () => {
    renderWithProviders(<ApplicationPage />, { params: { id: 'app_bay' } });
    expect(await screen.findByText('Email sent to careers@baydigital.example.com')).toBeInTheDocument();
    expect(screen.getByText('Email delivered; no bounce received within 48 hours')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Original circular/ })).toHaveAttribute('href', '/opportunities/opp_bd_dhaka/circular');
  });
});

describe('ProfilePage', () => {
  it('reorders contacts and changes the primary email', async () => {
    const { services } = renderWithProviders(<ProfilePage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Move down: admin@sober.com' }));
    await waitFor(async () => {
      const contacts = (await services.api.profile.getProfile()).contacts.sort((a, b) => a.position - b.position);
      expect(contacts[0]?.id).toBe('c_phone_mobile');
    });
    fireEvent.click(screen.getByRole('button', { name: 'Make primary: ayesha.personal@example.com' }));
    await waitFor(async () => {
      const profile = await services.api.profile.getProfile();
      expect(profile.contacts.find((c) => c.isPrimary && c.kind === 'email')?.id).toBe('c_email_personal');
    });
  });

  it('opens the zoomable photo viewer', async () => {
    renderWithProviders(<ProfilePage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Photo. Tap to view and zoom' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Zoom in' }));
    expect(within(dialog).getByText('200%')).toBeInTheDocument();
  });
});

