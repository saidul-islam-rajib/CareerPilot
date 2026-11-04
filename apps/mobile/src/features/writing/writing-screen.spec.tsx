import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { mockParams, renderWithProviders } from '@/test/render';
import { ApprovalScreen } from '../approvals/approval-screen';
import { WritingScreen } from './writing-screen';

async function writeLetter() {
  const view = await renderWithProviders(<WritingScreen />);
  await screen.findByText('Writing for Senior Frontend Engineer at Northwind Labs');
  await fireEvent.press(screen.getByTestId('generate-draft'));
  await screen.findByText('Version 1');
  return view;
}

describe('WritingScreen', () => {
  beforeEach(() => {
    mockParams.current = { opportunityId: 'opp_remote_frontend' };
  });

  it('says AI is not configured and blocks kinds that need it', async () => {
    const { unmount } = await renderWithProviders(<WritingScreen />);
    expect(await screen.findByText(/AI is not configured on this server/)).toBeTruthy();
    await fireEvent.press(screen.getByLabelText(/Essay answer/));
    expect(await screen.findByText('This kind of writing needs AI, which is not configured.')).toBeTruthy();
    expect(screen.getByTestId('generate-draft').props.accessibilityState?.disabled).toBe(true);
    await unmount();
  });

  it('writes a template draft that passes the checks', async () => {
    const { unmount } = await writeLetter();
    expect(screen.getByText('Template from your profile facts')).toBeTruthy();
    expect(screen.getByText('No unsupported claims, other employers or placeholders found.')).toBeTruthy();
    await unmount();
  });

  it('flags another employer and removes the flagged sentence as a new version', async () => {
    const { unmount } = await writeLetter();
    await fireEvent.changeText(screen.getByLabelText('Text'), 'Dear Northwind Labs hiring team, I want to join.\n\nI also admire Kite Commerce.');
    await fireEvent.press(screen.getByTestId('save-version'));
    expect(await screen.findByText('Version 2')).toBeTruthy();
    expect(await screen.findByText(/Mentions another employer \(Kite Commerce\)/)).toBeTruthy();
    await fireEvent.press(screen.getByTestId('strip-flagged'));
    expect(await screen.findByText('Version 3')).toBeTruthy();
    expect(screen.getByLabelText('Text').props.value).not.toContain('Kite Commerce');
    await unmount();
  });

  it('adds a passing draft to the application and shows it on the approval screen', async () => {
    const { unmount, services } = await writeLetter();
    await waitFor(() => expect(screen.getByTestId('attach-draft').props.accessibilityState?.disabled).toBeFalsy());
    await fireEvent.press(screen.getByTestId('attach-draft'));
    expect(await screen.findByText('In the application for approval')).toBeTruthy();
    const approval = await services.api.approvals.getApproval('apr_frontend');
    expect(approval.materials.writing).toHaveLength(1);
    await unmount();
    mockParams.current = { id: 'apr_frontend' };
    const approvalView = await renderWithProviders(<ApprovalScreen />, { services });
    expect(await screen.findByText(/Cover letter, version 1 \(Template from your profile facts\)/)).toBeTruthy();
    await approvalView.unmount();
  });

  it('removes a version after confirmation', async () => {
    const { unmount } = await writeLetter();
    await fireEvent.press(screen.getByTestId('remove-draft'));
    await fireEvent.press(await screen.findByTestId('confirm-remove'));
    expect(await screen.findByText('No drafts yet for this application.')).toBeTruthy();
    await unmount();
  });
});
