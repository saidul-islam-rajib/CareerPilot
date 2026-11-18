import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { ApprovalState } from '@careerpilot/domain-ui-logic';
import { createTestServices, renderWithProviders } from '@/test/render';
import { BulkApprovalsScreen } from './bulk-approvals-screen';

describe('bulk approvals screen', () => {
  it('approves only the packages that are shown as free of warnings', async () => {
    const services = createTestServices();
    const rows = await services.api.approvals.bulkRows();
    const eligible = rows.filter((row) => row.eligible);
    const blocked = rows.filter((row) => !row.eligible);
    const { unmount } = await renderWithProviders(<BulkApprovalsScreen />, { services });
    await fireEvent.press(await screen.findByText('Select all that can be approved together'));
    await fireEvent.press(screen.getByTestId('bulk-approve'));
    await waitFor(async () => {
      const pending = (await services.api.approvals.listApprovals()).filter((a) => a.state === ApprovalState.Pending);
      expect(pending.map((a) => a.id)).toEqual(blocked.map((row) => row.approvalId));
    });
    expect(eligible.length).toBeGreaterThan(0);
    await unmount();
  });
});
