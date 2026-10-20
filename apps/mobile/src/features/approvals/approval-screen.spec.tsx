import { fireEvent, screen } from '@testing-library/react-native';
import { SubmissionStatus } from '@careerpilot/domain-ui-logic';
import { ApplicationFilter } from '@careerpilot/api-client';
import { mockParams, mockRouter, renderWithProviders } from '@/test/render';
import { ApprovalScreen } from './approval-screen';
import { ApprovalsScreen } from './approvals-screen';

describe('ApprovalsScreen', () => {
  it('lists pending approvals and opens one', async () => {
    renderWithProviders(<ApprovalsScreen />);
    expect(await screen.findByText('2 waiting for your approval')).toBeTruthy();
    fireEvent.press(screen.getByLabelText(/Software Engineer II, Nordlys Systems/));
    expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/approval/[id]', params: { id: 'apr_oslo' } });
  });
});

describe('ApprovalScreen', () => {
  beforeEach(() => {
    mockParams.current = { id: 'apr_frontend' };
  });

  it('shows materials and marks AI-drafted answers', async () => {
    renderWithProviders(<ApprovalScreen />);
    expect(await screen.findByText('Why do you want to join Northwind Labs?')).toBeTruthy();
    expect(screen.getByText('Drafted by AI, check before approving')).toBeTruthy();
    expect(screen.getByText(/Dear Northwind Labs hiring team/)).toBeTruthy();
  });

  it('edits an answer before approving', async () => {
    const { services } = renderWithProviders(<ApprovalScreen />);
    await screen.findByText('What is your notice period?');
    fireEvent.press(screen.getAllByText('Edit')[0]!);
    fireEvent.changeText(screen.getByLabelText('Edit answer'), '15 days');
    fireEvent.press(screen.getByText('Save'));
    expect(await screen.findByText('15 days')).toBeTruthy();
    const detail = await services.api.approvals.getApproval('apr_frontend');
    expect(detail.materials.answers.find((a) => a.id === 'q_notice')?.answer).toBe('15 days');
  });

  it('asks for confirmation, then queues the application automatically', async () => {
    const { services } = renderWithProviders(<ApprovalScreen />);
    fireEvent.press(await screen.findByTestId('approve'));
    expect(screen.getByText('Approve this application?')).toBeTruthy();
    fireEvent.press(screen.getByTestId('confirm-approve'));
    expect(await screen.findByText(/CareerPilot will complete the application automatically at 00:00–01:00/)).toBeTruthy();
    const active = await services.api.applications.listApplications(ApplicationFilter.Active);
    expect(active.find((a) => a.opportunity.id === 'opp_remote_frontend')?.submissionStatus).toBe(SubmissionStatus.ApprovedQueued);
  });

  it('rejects an application', async () => {
    renderWithProviders(<ApprovalScreen />);
    fireEvent.press(await screen.findByTestId('reject'));
    expect(await screen.findByText("We won't apply to this opportunity.")).toBeTruthy();
  });
});
