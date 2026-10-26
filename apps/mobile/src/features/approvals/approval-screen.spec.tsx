import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { SubmissionStatus } from '@careerpilot/domain-ui-logic';
import { ApplicationFilter } from '@careerpilot/api-client';
import { mockParams, mockRouter, renderWithProviders } from '@/test/render';
import { ApprovalScreen } from './approval-screen';
import { ApprovalsScreen } from './approvals-screen';

describe('ApprovalsScreen', () => {
  it('lists pending approvals and opens one', async () => {
    await renderWithProviders(<ApprovalsScreen />);
    expect(await screen.findByText('2 waiting for your approval')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText(/Software Engineer II, Nordlys Systems/));
    expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/approval/[id]', params: { id: 'apr_oslo' } });
  });
});

describe('ApprovalScreen', () => {
  beforeEach(() => {
    mockParams.current = { id: 'apr_frontend' };
  });

  it('shows materials and marks AI-drafted answers', async () => {
    await renderWithProviders(<ApprovalScreen />);
    expect(await screen.findByText('Why do you want to join Northwind Labs?')).toBeTruthy();
    expect(screen.getByText('Drafted by AI, check before approving')).toBeTruthy();
    expect(screen.getByText(/Dear Northwind Labs hiring team/)).toBeTruthy();
  });

  it('edits an answer before approving', async () => {
    const { services } = await renderWithProviders(<ApprovalScreen />);
    await screen.findByText('What is your notice period?');
    await fireEvent.press(screen.getAllByText('Edit')[0]!);
    await fireEvent.changeText(screen.getByLabelText('Edit answer'), '15 days');
    await fireEvent.press(screen.getByText('Save'));
    expect(await screen.findByText('15 days')).toBeTruthy();
    const detail = await services.api.approvals.getApproval('apr_frontend');
    expect(detail.materials.answers.find((a) => a.id === 'q_notice')?.answer).toBe('15 days');
  });

  it('asks for confirmation, then queues the application automatically', async () => {
    const { services } = await renderWithProviders(<ApprovalScreen />);
    await fireEvent.press(await screen.findByTestId('approve'));
    expect(screen.getByText('Approve this application?')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('confirm-approve'));
    expect(await screen.findByText(/CareerPilot will complete the application automatically at 00:00–01:00/)).toBeTruthy();
    const active = await services.api.applications.listApplications(ApplicationFilter.Active);
    expect(active.find((a) => a.opportunity.id === 'opp_remote_frontend')?.submissionStatus).toBe(SubmissionStatus.ApprovedQueued);
  });

  it('rejects an application', async () => {
    await renderWithProviders(<ApprovalScreen />);
    await fireEvent.press(await screen.findByTestId('reject'));
    expect(await screen.findByText("We won't apply to this opportunity.")).toBeTruthy();
  });
});

describe('Approval questions', () => {
  it('blocks approval until the blank question is answered and saves it for reuse', async () => {
    mockParams.current = { id: 'apr_oslo' };
    const { services } = await renderWithProviders(<ApprovalScreen />);
    expect(await screen.findByText('Answer every question before approving.')).toBeTruthy();
    expect(screen.getByTestId('approve').props.accessibilityState).toMatchObject({ disabled: true });
    await fireEvent.changeText(screen.getByTestId('answer-q_relocate'), 'Yes');
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Save this answer for similar questions' }));
    await fireEvent.press(screen.getByTestId('save-answer-q_relocate'));
    await waitFor(() => expect(screen.queryByText('Answer every question before approving.')).toBeNull());
    const bank = await services.api.answers.getQuestionBank();
    expect(bank.saved.map((a) => a.question)).toContain('Are you willing to relocate to Oslo?');
  });
});
