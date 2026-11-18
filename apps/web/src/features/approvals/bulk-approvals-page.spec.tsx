import { fireEvent, screen, waitFor } from '@testing-library/react';
import { createMemoryStore } from '@careerpilot/client-core';
import { ApprovalState } from '@careerpilot/domain-ui-logic';
import { createTestServices, renderWithProviders, testNow } from '@/test/render';
import { BulkApprovalsPage } from './bulk-approvals-page';

describe('bulk approvals page', () => {
  it('approves only the packages that are shown as free of warnings', async () => {
    const services = createTestServices(createMemoryStore({}), { now: () => new Date(testNow) });
    const rows = await services.api.approvals.bulkRows();
    const eligible = rows.filter((row) => row.eligible);
    const blocked = rows.filter((row) => !row.eligible);
    expect(eligible.length).toBeGreaterThan(0);
    expect(blocked.length).toBeGreaterThan(0);
    renderWithProviders(<BulkApprovalsPage />, { services });
    fireEvent.click(await screen.findByRole('button', { name: 'Select all that can be approved together' }));
    fireEvent.click(screen.getByRole('button', { name: `Approve ${eligible.length} selected` }));
    await waitFor(async () => {
      const pending = (await services.api.approvals.listApprovals()).filter((a) => a.state === ApprovalState.Pending);
      expect(pending.map((a) => a.id)).toEqual(blocked.map((row) => row.approvalId));
    });
  });

  it('refuses a package that changed after it was shown', async () => {
    const services = createTestServices(createMemoryStore({}), { now: () => new Date(testNow) });
    const [first] = (await services.api.approvals.bulkRows()).filter((row) => row.eligible);
    const detail = await services.api.approvals.getApproval(first!.approvalId);
    await services.api.approvals.updateAnswer(first!.approvalId, detail.materials.answers[0]!.id, 'Changed answer');
    const result = await services.api.approvals.bulkApprove([{ approvalId: first!.approvalId, reviewToken: first!.reviewToken }]);
    expect(result.approved).toEqual([]);
    expect(result.refused[0]?.reasons).toEqual(['changed']);
  });
});
