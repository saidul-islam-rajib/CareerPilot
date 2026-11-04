import { fireEvent, screen, waitFor } from '@testing-library/react';
import { renderAdmin } from '@/test/render';
import { GovernmentAdminPage } from './government-admin-page';

describe('GovernmentAdminPage', () => {
  it('creates a circular with a post, publishes it, and adds a holiday', async () => {
    await renderAdmin(<GovernmentAdminPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'New circular' }));
    fireEvent.change(screen.getByLabelText('Agency'), { target: { value: 'Ministry of Public Administration' } });
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Recruitment of Assistant Officers' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add post' }));
    fireEvent.change(screen.getByLabelText('Post title'), { target: { value: 'Assistant Officer' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Recruitment of Assistant Officers')).toBeInTheDocument();
    expect(screen.getByText('Draft')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Publish' }));
    expect(await screen.findByText('Published')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-11-12' } });
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Special holiday' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add holiday' }));
    await waitFor(() => expect(screen.getByText('2026-11-12 · Special holiday')).toBeInTheDocument());
  });

  it('shows the fixed holidays are kept in settings and the steps need posts before publishing', async () => {
    await renderAdmin(<GovernmentAdminPage />);
    expect(await screen.findByText(/Fixed national days come from settings/)).toBeInTheDocument();
    expect(screen.getAllByText('None yet.').length).toBeGreaterThan(0);
  });
});
