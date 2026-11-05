import { fireEvent, screen } from '@testing-library/react';
import { renderAdmin } from '@/test/render';
import { PortalsAdminPage } from './portals-admin-page';

describe('PortalsAdminPage', () => {
  it('runs a read-only readiness check and shows a host waiting for review', async () => {
    await renderAdmin(<PortalsAdminPage />);
    expect(await screen.findByText('No portals yet.')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Job link'), { target: { value: 'https://jobs.example.com/apply' } });
    fireEvent.click(screen.getByRole('button', { name: 'Check readiness' }));
    expect(await screen.findByText(/waiting for admin approval/)).toBeInTheDocument();
  });

  it('approves a host once it is listed', async () => {
    await renderAdmin(<PortalsAdminPage />);
    fireEvent.change(await screen.findByLabelText('Job link'), { target: { value: 'https://jobs.example.com/apply' } });
    fireEvent.click(screen.getByRole('button', { name: 'Check readiness' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Allow' }));
    expect(await screen.findByText('Allowed')).toBeInTheDocument();
  });
});
