import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { renderWithProviders } from '@/test/render';
import { SettingsPage } from './settings-page';
import { CountriesPage } from './countries-page';
import { SourcesPage } from './sources-page';

const SUBMIT = 'Find jobs and add';

describe('SourcesPage', () => {
  it('adds a source from a website link, shows it waiting for review, and removes it', async () => {
    renderWithProviders(<SourcesPage />);
    expect(await screen.findByText(/You haven.t added any sources yet/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Add a source' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: SUBMIT }));
    expect(await within(dialog).findByText('This field is required.')).toBeInTheDocument();
    fireEvent.change(within(dialog).getByLabelText('Website link'), { target: { value: 'ftp://jobs.example.org' } });
    fireEvent.click(within(dialog).getByRole('button', { name: SUBMIT }));
    expect(await within(dialog).findByText('Use a website on the public internet.')).toBeInTheDocument();
    fireEvent.change(within(dialog).getByLabelText('Website link'), { target: { value: 'careers.example.org' } });
    fireEvent.change(within(dialog).getByLabelText('Why this site? (optional)'), { target: { value: 'Hires in Dhaka' } });
    fireEvent.click(within(dialog).getByRole('button', { name: SUBMIT }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(await screen.findByText('careers.example.org added with 0 jobs. Matching jobs appear in your lists.')).toBeInTheDocument();
    expect(screen.getByText('Waiting for review')).toBeInTheDocument();
    expect(screen.getByText('Only you see its jobs until an administrator shares it with everyone.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Remove source: careers.example.org' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Remove source' }));
    expect(await screen.findByText('careers.example.org removed')).toBeInTheDocument();
    expect(await screen.findByText(/You haven.t added any sources yet/)).toBeInTheDocument();
  });

  it('is linked from settings', () => {
    renderWithProviders(<SettingsPage />);
    expect(screen.getByRole('link', { name: /Job sources/ })).toHaveAttribute('href', '/settings/sources');
  });
});

describe('CountriesPage', () => {
  it('adds and removes excluded countries', async () => {
    const { services } = renderWithProviders(<CountriesPage />);
    expect(await screen.findByText(/No countries excluded/)).toBeInTheDocument();
    const input = screen.getByLabelText('Country codes');
    fireEvent.change(input, { target: { value: 'in' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    await waitFor(async () => expect((await services.api.settings.getSettings()).excludedCountries).toEqual(['IN']));
    fireEvent.click(await screen.findByRole('button', { name: 'Remove IN' }));
    await waitFor(async () => expect((await services.api.settings.getSettings()).excludedCountries).toEqual([]));
  });
});
