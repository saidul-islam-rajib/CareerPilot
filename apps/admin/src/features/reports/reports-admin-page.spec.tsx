import { fireEvent, screen, waitFor } from '@testing-library/react';
import { renderAdmin } from '@/test/render';
import { ReportsAdminPage } from './reports-admin-page';

describe('ReportsAdminPage', () => {
  it('lists open reports and records a review in the audit log', async () => {
    const { services } = await renderAdmin(<ReportsAdminPage />);
    expect(await screen.findByText('The apply link shows a not found page.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Mark as action taken' }));
    await waitFor(async () => expect(await services.api.opportunities.listReports('open')).toHaveLength(0));
    const audit = await services.api.audit.listAudit({ page: 1, pageSize: 20 });
    expect(audit.items.some((entry) => entry.action === 'opportunity_report.status_changed.actioned')).toBe(true);
  });
});
