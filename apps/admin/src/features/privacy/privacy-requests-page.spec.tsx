import { screen } from '@testing-library/react';
import { renderAdmin } from '@/test/render';
import { PrivacyRequestsPage } from './privacy-requests-page';

describe('PrivacyRequestsPage', () => {
  it('lists deletion and export requests with their status', async () => {
    await renderAdmin(<PrivacyRequestsPage />);
    expect(await screen.findByRole('heading', { name: 'Privacy requests' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Deletion requests' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Export requests' })).toBeInTheDocument();
    expect(screen.getAllByText('Nothing here yet.')).toHaveLength(2);
  });
});
