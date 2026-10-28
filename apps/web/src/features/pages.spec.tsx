import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
    expect(await screen.findByLabelText('Awaiting approval: 2')).toHaveAttribute('href', '/approvals');
    expect(await screen.findByRole('heading', { name: 'Bangladesh government' })).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: /Senior Frontend Engineer/ })).toHaveAttribute('href', '/opportunities/opp_remote_frontend');
    expect(await screen.findByRole('heading', { name: 'Coming up' })).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: /First interview with the engineering manager/ })).toHaveAttribute('href', '/applications/app_bay');
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
    expect(screen.queryByText("Finish this application on the employer's site")).not.toBeInTheDocument();
  });

  it('points to the employer site when only the user can finish the application', async () => {
    renderWithProviders(<ApplicationPage />, { params: { id: 'app_harbour' } });
    expect(await screen.findByText("Finish this application on the employer's site")).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open the application page' })).toHaveAttribute('href', expect.stringMatching(/^https:\/\//));
  });
});

describe('Application follow-ups', () => {
  it('updates the outcome and records it in the timeline', async () => {
    const user = userEvent.setup();
    const { services } = renderWithProviders(<ApplicationPage />, { params: { id: 'app_kite' } });
    await user.click(await screen.findByRole('button', { name: 'Update outcome' }));
    const dialog = await screen.findByRole('dialog', { name: 'Update outcome' });
    await user.selectOptions(within(dialog).getByLabelText('Outcome'), 'withdrawn');
    expect(within(dialog).getByText(/doesn't tell the employer/)).toBeInTheDocument();
    await user.selectOptions(within(dialog).getByLabelText('Outcome'), 'interview');
    await user.type(within(dialog).getByLabelText('Note (optional)'), 'Call on Monday');
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Outcome updated')).toBeInTheDocument();
    expect(await screen.findByText('Outcome set to Interview: Call on Monday')).toBeInTheDocument();
    expect((await services.api.applications.getApplication('app_kite')).outcomeStatus).toBe('interview');
  });

  it('adds a follow-up in the user time zone and marks it done', async () => {
    const user = userEvent.setup();
    const { services } = renderWithProviders(<ApplicationPage />, { params: { id: 'app_kite' } });
    await user.click(await screen.findByRole('button', { name: 'Add follow-up' }));
    const dialog = await screen.findByRole('dialog', { name: 'Add follow-up' });
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    expect(await within(dialog).findByText('This field is required.')).toBeInTheDocument();
    await user.type(within(dialog).getByLabelText('What'), 'Video interview');
    fireEvent.change(within(dialog).getByLabelText('Time'), { target: { value: '10:00' } });
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    expect(await within(dialog).findByText('Choose a date for this time.')).toBeInTheDocument();
    await user.selectOptions(within(dialog).getByLabelText('Type'), 'interview');
    fireEvent.change(within(dialog).getByLabelText('Date'), { target: { value: '2026-10-22' } });
    await user.type(within(dialog).getByLabelText('Where or meeting link'), 'https://meet.example/abc');
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Follow-up saved')).toBeInTheDocument();
    const task = (await services.api.applications.getApplication('app_kite')).tasks.at(-1);
    expect(task).toMatchObject({ kind: 'interview', title: 'Video interview', dueAt: '2026-10-22T04:00:00.000Z', location: 'https://meet.example/abc' });
    expect(await screen.findByRole('link', { name: 'https://meet.example/abc' })).toHaveAttribute('href', 'https://meet.example/abc');
    await user.click(screen.getByRole('button', { name: 'Mark done: Video interview' }));
    await waitFor(async () => expect((await services.api.applications.getApplication('app_kite')).tasks.at(-1)?.status).toBe('done'));
  });

  it('suggests a follow-up after a quiet period', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ApplicationPage />, { params: { id: 'app_meghna' }, laterByDays: 15 });
    expect(await screen.findByText('No response for 14 days. A short, polite follow-up email can help.')).toBeInTheDocument();
    const suggestion = screen.getByText('Suggestion').closest('[role="status"]');
    if (!(suggestion instanceof HTMLElement)) {
      throw new Error('expected the suggestion banner');
    }
    await user.click(within(suggestion).getByRole('button', { name: 'Add follow-up' }));
    const dialog = await screen.findByRole('dialog', { name: 'Add follow-up' });
    expect(within(dialog).getByLabelText('What')).toHaveValue('Follow up on my application');
    expect(within(dialog).getByLabelText('Date')).toHaveValue('2026-11-04');
  });
});

describe('Approval questions', () => {
  it('blocks approval until every question has an answer and can save the answer for reuse', async () => {
    const user = userEvent.setup();
    const { services } = renderWithProviders(<ApprovalPage />, { params: { id: 'apr_oslo' } });
    expect(await screen.findByText('Answer every question before approving.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Approve and send' })).toBeDisabled();
    expect(screen.getByText('Needs your answer')).toBeInTheDocument();
    const field = screen.getByLabelText('Edit answer');
    await user.type(field, 'Yes');
    await user.click(screen.getByRole('checkbox', { name: 'Save this answer for similar questions' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Approve and send' })).toBeEnabled());
    const bank = await services.api.answers.getQuestionBank();
    expect(bank.saved.map((a) => a.question)).toContain('Are you willing to relocate to Oslo?');
  });
});
