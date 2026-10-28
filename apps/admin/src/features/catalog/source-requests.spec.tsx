import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { renderAdmin } from '@/test/render';
import { SourcesPage } from './catalog-pages';

const REQUEST = 'Acme careers';

describe('reviewing sources users added', () => {
  it('shows who asked and why, requires a justification, and shares the source with everyone', async () => {
    const { services } = await renderAdmin(<SourcesPage />);
    expect(await screen.findByText('Waiting for review (1)')).toBeInTheDocument();
    expect(screen.getByText('Reason: Local employer hiring engineers')).toBeInTheDocument();
    expect(screen.getByText(/Added by 1 user/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: `Approve: ${REQUEST}` }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(`Share ${REQUEST} with everyone?`)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Approve' }));
    expect(await within(dialog).findByText('This field is required.')).toBeInTheDocument();
    fireEvent.change(within(dialog).getByLabelText('Justification'), { target: { value: 'Real employer in Dhaka' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Approve' }));
    expect(await screen.findByText(`${REQUEST} is now shared with everyone.`)).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText('Waiting for review (1)')).not.toBeInTheDocument());
    expect(await services.api.sources.sourceRequests()).toEqual([]);
  });

  it('keeps a source private with a reason', async () => {
    const { services } = await renderAdmin(<SourcesPage />);
    fireEvent.click(await screen.findByRole('button', { name: `Keep private: ${REQUEST}` }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Justification'), { target: { value: 'Recruiting agency' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Keep private' }));
    expect(await screen.findByText(`${REQUEST} stays private.`)).toBeInTheDocument();
    const rows = await services.api.sources.listSources({ search: REQUEST, page: 1, pageSize: 10 });
    expect(rows.items.find((row) => row.name === REQUEST)).toMatchObject({ review: 'rejected', reviewNote: 'Recruiting agency' });
  });

  it('lets read-only admins see requests without deciding', async () => {
    await renderAdmin(<SourcesPage />, { email: 'viewer@sober.com' });
    expect(await screen.findByText('Waiting for review (1)')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: `Approve: ${REQUEST}` })).not.toBeInTheDocument();
  });
});
