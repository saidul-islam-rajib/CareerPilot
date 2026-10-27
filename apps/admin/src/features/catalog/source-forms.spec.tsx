import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { renderAdmin, suggestedSources } from '@/test/render';
import { SourcesPage } from './catalog-pages';

const FIRST = suggestedSources[0]!;

describe('adding job sources', () => {
  it('adds a suggested source with one click', async () => {
    await renderAdmin(<SourcesPage />);
    const add = await screen.findByRole('button', { name: `Add: ${FIRST.name}` });
    fireEvent.click(add);
    expect(await screen.findByText('Source added and checked. Its jobs are being matched to users.')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('button', { name: `Add: ${FIRST.name}` })).not.toBeInTheDocument());
    expect((await screen.findAllByText(FIRST.name)).length).toBeGreaterThan(0);
  });

  it('adds a source from the form and explains unsafe addresses', async () => {
    await renderAdmin(<SourcesPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Add source' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add and check now' }));
    expect(await within(dialog).findAllByText('This field is required.')).toHaveLength(2);
    fireEvent.change(within(dialog).getByLabelText('Name'), { target: { value: 'Company board' } });
    fireEvent.change(within(dialog).getByLabelText('Address'), { target: { value: 'http://jobs.example.org/feed.rss' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add and check now' }));
    expect(await within(dialog).findByText('Use an https address on the public internet.')).toBeInTheDocument();
    fireEvent.change(within(dialog).getByLabelText('Address'), { target: { value: 'https://jobs.example.org/feed.rss' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add and check now' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(await screen.findByText('Company board')).toBeInTheDocument();
  });

  it('offers adding only to admins allowed to create sources', async () => {
    await renderAdmin(<SourcesPage />, { email: 'operations@sober.com' });
    await screen.findByText('Sources');
    expect(screen.queryByRole('button', { name: 'Add source' })).not.toBeInTheDocument();
    expect(screen.queryByText('Suggested sources')).not.toBeInTheDocument();
  });
});
