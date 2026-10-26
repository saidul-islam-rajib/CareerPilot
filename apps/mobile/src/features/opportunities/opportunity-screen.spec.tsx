import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { mockParams, mockRouter, renderWithProviders } from '@/test/render';
import { CircularScreen } from './circular-screen';
import { OpportunityScreen } from './opportunity-screen';

describe('OpportunityScreen', () => {
  it('explains the match, requirements, and the archived circular', async () => {
    mockParams.current = { id: 'opp_remote_frontend' };
    await renderWithProviders(<OpportunityScreen />);
    expect(await screen.findByText('Senior Frontend Engineer')).toBeTruthy();
    expect(screen.getByText('React and TypeScript match your 5 years of experience')).toBeTruthy();
    expect(screen.getByText('GraphQL in production')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText(/View archived circular/));
    expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/circular/[opportunityId]', params: { opportunityId: 'opp_remote_frontend' } });
  });

  it('warns about a hard requirement failure', async () => {
    mockParams.current = { id: 'opp_gov_programmer' };
    await renderWithProviders(<OpportunityScreen />);
    expect(await screen.findByText(/A hard requirement is not met/)).toBeTruthy();
  });

  it('prepares an application for approval', async () => {
    mockParams.current = { id: 'opp_bd_ctg' };
    const { services } = await renderWithProviders(<OpportunityScreen />);
    await fireEvent.press(await screen.findByTestId('prepare-application'));
    expect(await screen.findByText(/You'll review it before anything is sent/)).toBeTruthy();
    const approvals = await services.api.approvals.listApprovals();
    expect(approvals.some((a) => a.opportunity.id === 'opp_bd_ctg')).toBe(true);
  });

  it('dismisses and goes back', async () => {
    mockParams.current = { id: 'opp_bd_ctg' };
    await renderWithProviders(<OpportunityScreen />);
    await fireEvent.press(await screen.findByText('Dismiss'));
    await waitFor(() => expect(mockRouter.back).toHaveBeenCalled());
  });
});

describe('CircularScreen', () => {
  it('shows the archived circular text', async () => {
    mockParams.current = { opportunityId: 'opp_bd_dhaka' };
    await renderWithProviders(<CircularScreen />);
    expect(await screen.findByText(/Salary: BDT 120,000/)).toBeTruthy();
  });
});
